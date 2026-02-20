/**
 * Killer-Skills Workflows Entrypoint
 *
 * 独立的 Worker，包含所有 Workflow 定义
 */

// 导出 Workflow 类
export { TranslationWorkflow } from "./translation-workflow";
export { SkillValidationWorkflow } from "./skill-validation-workflow";
export { ContentProcessingWorkflow } from "./content-workflow";

import {
    type Workflow,
} from "cloudflare:workers";

interface Env {
    TRANSLATION_WORKFLOW: Workflow;
    SKILL_VALIDATION_WORKFLOW: Workflow;
    CONTENT_WORKFLOW: Workflow;
    GITHUB_TOKEN?: string;
}

// Worker fetch handler
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === "/health") {
            return new Response(
                JSON.stringify({
                    status: "ok",
                    workflows: [
                        "translation-workflow",
                        "skill-validation-workflow",
                        "content-workflow"
                    ],
                }),
                {
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        // Trigger Workflows
        if (request.method === "POST" && url.pathname.startsWith("/workflows/")) {
            const workflowName = url.pathname.split("/")[2];
            let workflow: Workflow | undefined;

            switch (workflowName) {
                case "translation":
                    workflow = env.TRANSLATION_WORKFLOW;
                    break;
                case "validation":
                    workflow = env.SKILL_VALIDATION_WORKFLOW;
                    break;
                case "content":
                    workflow = env.CONTENT_WORKFLOW;
                    break;
                default:
                    return new Response("Workflow not found", { status: 404 });
            }

            if (workflow) {
                const body = await request.json();
                const instance = await workflow.create({ params: body });
                return new Response(
                    JSON.stringify({
                        success: true,
                        id: instance.id,
                        workflow: workflowName
                    }),
                    {
                        headers: { "Content-Type": "application/json" },
                        status: 202
                    }
                );
            }
        }

        // Webhook receiver for GitHub push events (Zero-Latency Pipeline)
        if (request.method === "POST" && url.pathname === "/api/webhook/github") {
            try {
                // Verify GitHub event explicitly
                const githubEvent = request.headers.get("x-github-event");
                if (githubEvent !== "push" && githubEvent !== "create") {
                    return new Response("Ignored event type", { status: 200 });
                }

                const payload: any = await request.json();
                const targetRepo = payload?.repository?.full_name;

                if (!targetRepo) {
                    return new Response("Missing repository data", { status: 400 });
                }

                if (!env.GITHUB_TOKEN) {
                    return new Response("Worker missing GITHUB_TOKEN binding", { status: 500 });
                }

                console.log(`[Webhook] Dispatching ingestion event for ${targetRepo}`);

                // Send repository_dispatch to the core project: asiawright1122-boop/Killer-AgentSkills
                const dispatchRes = await fetch("https://api.github.com/repos/asiawright1122-boop/Killer-AgentSkills/dispatches", {
                    method: "POST",
                    headers: {
                        "Accept": "application/vnd.github.v3+json",
                        "Authorization": `token ${env.GITHUB_TOKEN}`,
                        "User-Agent": "Killer-Skills-Cloudflare-Worker"
                    },
                    body: JSON.stringify({
                        event_type: "killer-skills-ingest",
                        client_payload: {
                            target_repo: targetRepo
                        }
                    })
                });

                if (!dispatchRes.ok) {
                    const errText = await dispatchRes.text();
                    console.error("[Webhook] GitHub Dispatch Failed:", errText);
                    return new Response("Dispatch relay failed", { status: 502 });
                }

                return new Response(JSON.stringify({
                    success: true,
                    message: "Dispatch relay confirmed",
                    repo: targetRepo
                }), { status: 202, headers: { "Content-Type": "application/json" } });

            } catch (e: any) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500 });
            }
        }

        return new Response(
            "Killer-Skills Workflows Worker\n\nEndpoints:\n- POST /workflows/translation\n- POST /workflows/validation\n- POST /workflows/content\n\nPayload: JSON object matching workflow params.",
            { status: 200 }
        );
    },
};
