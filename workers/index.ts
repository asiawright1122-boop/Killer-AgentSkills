/**
 * Killer-Skills Workflows Entrypoint
 *
 * 独立的 Worker，包含所有 Workflow 定义
 */

// 导出 Workflow 类
export { TranslationWorkflow } from './translation-workflow';
export { SkillValidationWorkflow } from './skill-validation-workflow';
export { ContentProcessingWorkflow } from './content-workflow';

import { type Workflow } from 'cloudflare:workers';

interface Env {
  TRANSLATION_WORKFLOW: Workflow;
  SKILL_VALIDATION_WORKFLOW: Workflow;
  CONTENT_WORKFLOW: Workflow;
  GITHUB_TOKEN?: string;
  WEBHOOK_SECRET?: string;
  WORKFLOW_TRIGGER_SECRET?: string;
}

const PUBLIC_JSON_HEADERS = {
  'Content-Type': 'application/json',
  'X-Robots-Tag': 'noindex, nofollow',
} as const;

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function verifyBearerSecret(secret: string, authHeader: string | null): 'missing' | 'invalid' | 'valid' {
  const prefix = 'Bearer ';
  if (!authHeader || !authHeader.startsWith(prefix)) return 'missing';
  const token = authHeader.slice(prefix.length).trim();
  return timingSafeStringEqual(token, secret) ? 'valid' : 'invalid';
}

async function verifyGitHubSignature(secret: string, body: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = signatureHeader.slice('sha256='.length);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const actual = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeStringEqual(actual, expected);
}

// Worker fetch handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          workflows: ['translation-workflow', 'skill-validation-workflow', 'content-workflow'],
        }),
        {
          headers: PUBLIC_JSON_HEADERS,
        },
      );
    }

    // Trigger Workflows
    if (request.method === 'POST' && url.pathname.startsWith('/workflows/')) {
      if (!env.WORKFLOW_TRIGGER_SECRET) {
        return new Response('Workflow trigger secret not configured', { status: 503 });
      }

      const workflowAuth = verifyBearerSecret(env.WORKFLOW_TRIGGER_SECRET, request.headers.get('authorization'));
      if (workflowAuth === 'missing') {
        return new Response('Unauthorized', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Bearer' },
        });
      }
      if (workflowAuth === 'invalid') {
        return new Response('Forbidden', { status: 403 });
      }

      const workflowName = url.pathname.split('/')[2];
      let workflow: Workflow | undefined;

      switch (workflowName) {
        case 'translation':
          workflow = env.TRANSLATION_WORKFLOW;
          break;
        case 'validation':
          workflow = env.SKILL_VALIDATION_WORKFLOW;
          break;
        case 'content':
          workflow = env.CONTENT_WORKFLOW;
          break;
        default:
          return new Response('Workflow not found', { status: 404 });
      }

      if (workflow) {
        const body = await request.json();
        const instance = await workflow.create({ params: body });
        return new Response(
          JSON.stringify({
            success: true,
            id: instance.id,
            workflow: workflowName,
          }),
          {
            headers: PUBLIC_JSON_HEADERS,
            status: 202,
          },
        );
      }
    }

    // Webhook receiver for GitHub push events (Zero-Latency Pipeline)
    if (request.method === 'POST' && url.pathname === '/api/webhook/github') {
      try {
        // HMAC-SHA256 signature verification (prevents forged webhook calls)
        const rawBody = await request.text();
        if (!env.WEBHOOK_SECRET) {
          return new Response('Webhook secret not configured', { status: 503 });
        }

        const signature = request.headers.get('x-hub-signature-256');
        const valid = await verifyGitHubSignature(env.WEBHOOK_SECRET, rawBody, signature);
        if (!valid) {
          console.error('[Webhook] Invalid signature — rejecting request');
          return new Response('Invalid signature', { status: 401 });
        }

        // Verify GitHub event explicitly
        const githubEvent = request.headers.get('x-github-event');
        if (githubEvent !== 'push' && githubEvent !== 'create') {
          return new Response('Ignored event type', { status: 200 });
        }

        const payload: any = JSON.parse(rawBody);
        const targetRepo = payload?.repository?.full_name;

        if (!targetRepo) {
          return new Response('Missing repository data', { status: 400 });
        }

        if (!env.GITHUB_TOKEN) {
          return new Response('Worker missing GITHUB_TOKEN binding', { status: 500 });
        }

        console.log(`[Webhook] Dispatching ingestion event for ${targetRepo}`);

        // Send repository_dispatch to the core project: asiawright1122-boop/Killer-AgentSkills
        const dispatchRes = await fetch(
          'https://api.github.com/repos/asiawright1122-boop/Killer-AgentSkills/dispatches',
          {
            method: 'POST',
            headers: {
              Accept: 'application/vnd.github.v3+json',
              Authorization: `token ${env.GITHUB_TOKEN}`,
              'User-Agent': 'Killer-Skills-Cloudflare-Worker',
            },
            body: JSON.stringify({
              event_type: 'killer-skills-ingest',
              client_payload: {
                target_repo: targetRepo,
              },
            }),
          },
        );

        if (!dispatchRes.ok) {
          const errText = await dispatchRes.text();
          console.error('[Webhook] GitHub Dispatch Failed:', errText);
          return new Response('Dispatch relay failed', { status: 502 });
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Dispatch relay confirmed',
            repo: targetRepo,
          }),
          { status: 202, headers: PUBLIC_JSON_HEADERS },
        );
      } catch (error) {
        console.error('[Webhook] Request failed:', error);
        return new Response(JSON.stringify({ error: 'Webhook dispatch failed' }), {
          status: 500,
          headers: PUBLIC_JSON_HEADERS,
        });
      }
    }

    return new Response(
      'Killer-Skills Workflows Worker\n\nEndpoints:\n- POST /workflows/translation\n- POST /workflows/validation\n- POST /workflows/content\n\nPayload: JSON object matching workflow params.',
      { status: 200 },
    );
  },
};
