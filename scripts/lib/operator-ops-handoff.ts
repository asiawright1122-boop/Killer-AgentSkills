import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type {
  OperatorRemediationHandoffMode,
  OperatorRemediationHandoffReport,
  OperatorRemediationHandoffScaffold,
} from './operator-ops-summary';

export const DEFAULT_OPS_HANDOFF_PUBLICATION_MD_PATH = 'reports/seo/latest-ops-handoff-publication.md';
export const DEFAULT_OPS_HANDOFF_PUBLICATION_JSON_PATH = 'reports/seo/latest-ops-handoff-publication.json';
export const DEFAULT_OPS_HANDOFF_JSON_PATH = 'reports/seo/latest-ops-handoff.json';

export type OperatorRemediationHandoffPublicationEntryStatus =
  | 'created'
  | 'updated'
  | 'reopened'
  | 'unchanged'
  | 'skipped'
  | 'failed'
  | 'dry_run';

export type OperatorRemediationHandoffRemoteKind = 'issue' | 'pull_request';

export type OperatorRemediationHandoffRemoteTarget = {
  kind: OperatorRemediationHandoffRemoteKind;
  number: number;
  url: string;
  state: string;
  title: string;
};

export type OperatorRemediationHandoffPublicationEntry = {
  scaffoldId: string;
  dedupeKey: string;
  mode: Exclude<OperatorRemediationHandoffMode, 'none'>;
  status: OperatorRemediationHandoffPublicationEntryStatus;
  reason: string | null;
  remote: OperatorRemediationHandoffRemoteTarget | null;
};

export type OperatorRemediationHandoffPublicationReport = {
  generatedAt: string;
  status: 'disabled' | 'completed' | 'partial';
  dryRun: boolean;
  disabledReason: string | null;
  sourceReportPath: string;
  repository: {
    owner: string | null;
    repo: string | null;
    baseBranch: string | null;
  };
  mode: OperatorRemediationHandoffMode;
  summary: {
    actionable: boolean;
    attempted: number;
    created: number;
    updated: number;
    reopened: number;
    unchanged: number;
    skipped: number;
    failed: number;
    dryRun: number;
  };
  entries: OperatorRemediationHandoffPublicationEntry[];
};

type GitHubIssue = {
  number: number;
  html_url: string;
  state: string;
  title: string;
  body: string | null;
  pull_request?: Record<string, unknown>;
};

type GitHubPullRequest = {
  number: number;
  html_url: string;
  state: string;
  title: string;
  body: string | null;
  draft: boolean;
  head: {
    ref: string;
    repo?: {
      owner?: {
        login?: string;
      } | null;
    } | null;
  };
};

type GitHubDraftPrResponse = {
  number: number;
  html_url: string;
  state: string;
  title: string;
  body: string | null;
  draft: boolean;
};

type GitHubRestClientOptions = {
  token: string;
  apiBaseUrl?: string;
};

const GITHUB_ACCEPT = 'application/vnd.github+json';
const GITHUB_API_VERSION = '2022-11-28';

function bodyIncludesDedupeKey(body: string | null | undefined, dedupeKey: string): boolean {
  const normalized = String(body || '');
  return (
    normalized.includes(`<!-- ops-handoff dedupe-key: ${dedupeKey} -->`) || normalized.includes(`- key: ${dedupeKey}`)
  );
}

function extractFingerprint(body: string | null | undefined): string | null {
  const normalized = String(body || '');
  const commentMatch = normalized.match(/<!-- ops-handoff fingerprint: ([a-f0-9]+) -->/i);
  if (commentMatch?.[1]) return commentMatch[1];
  const lineMatch = normalized.match(/- fingerprint: ([a-f0-9]+)/i);
  return lineMatch?.[1] || null;
}

function buildRemoteTarget(
  kind: OperatorRemediationHandoffRemoteKind,
  issue: Pick<GitHubIssue, 'number' | 'html_url' | 'state' | 'title'>,
): OperatorRemediationHandoffRemoteTarget {
  return {
    kind,
    number: issue.number,
    url: issue.html_url,
    state: issue.state,
    title: issue.title,
  };
}

class GitHubRestClient {
  private readonly token: string;
  private readonly apiBaseUrl: string;

  constructor(options: GitHubRestClientOptions) {
    this.token = options.token;
    this.apiBaseUrl = (options.apiBaseUrl || 'https://api.github.com').replace(/\/+$/, '');
  }

  public async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method,
      headers: {
        Accept: GITHUB_ACCEPT,
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`${method} ${path} failed (${response.status}): ${detail.slice(0, 400)}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}

async function listAllIssues(
  client: GitHubRestClient,
  owner: string,
  repo: string,
  labels: string[],
): Promise<GitHubIssue[]> {
  const items: GitHubIssue[] = [];

  for (let page = 1; page <= 10; page++) {
    const labelQuery = labels.length > 0 ? `&labels=${encodeURIComponent(labels.join(','))}` : '';
    const pageItems = await client.request<GitHubIssue[]>(
      'GET',
      `/repos/${owner}/${repo}/issues?state=all&per_page=100&page=${page}${labelQuery}`,
    );
    if (pageItems.length === 0) break;
    items.push(...pageItems);
    if (pageItems.length < 100) break;
  }

  return items;
}

async function listAllPullRequests(
  client: GitHubRestClient,
  owner: string,
  repo: string,
): Promise<GitHubPullRequest[]> {
  const items: GitHubPullRequest[] = [];

  for (let page = 1; page <= 10; page++) {
    const pageItems = await client.request<GitHubPullRequest[]>(
      'GET',
      `/repos/${owner}/${repo}/pulls?state=all&per_page=100&page=${page}`,
    );
    if (pageItems.length === 0) break;
    items.push(...pageItems);
    if (pageItems.length < 100) break;
  }

  return items;
}

function pickMatchingIssue(issues: GitHubIssue[], scaffold: OperatorRemediationHandoffScaffold): GitHubIssue | null {
  const matches = issues.filter(
    (issue) => !issue.pull_request && bodyIncludesDedupeKey(issue.body, scaffold.dedupeKey),
  );
  if (matches.length === 0) return null;
  const openMatch = matches.find((issue) => issue.state === 'open');
  return openMatch || matches[0];
}

function pickMatchingPullRequest(
  pulls: GitHubPullRequest[],
  scaffold: OperatorRemediationHandoffScaffold,
  owner: string,
): GitHubPullRequest | null {
  const matches = pulls.filter((pull) => {
    if (bodyIncludesDedupeKey(pull.body, scaffold.dedupeKey)) return true;
    if (!scaffold.branchName) return false;
    const headOwner = pull.head.repo?.owner?.login || owner;
    return pull.head.ref === scaffold.branchName && headOwner.toLowerCase() === owner.toLowerCase();
  });
  if (matches.length === 0) return null;
  const openMatch = matches.find((pull) => pull.state === 'open');
  return openMatch || matches[0];
}

async function branchExists(
  client: GitHubRestClient,
  owner: string,
  repo: string,
  branchName: string,
): Promise<boolean> {
  try {
    await client.request('GET', `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branchName)}`);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('(404)')) {
      return false;
    }
    throw error;
  }
}

async function publishIssueScaffold(
  client: GitHubRestClient,
  scaffold: OperatorRemediationHandoffScaffold,
  dryRun: boolean,
): Promise<OperatorRemediationHandoffPublicationEntry> {
  const { owner, repo } = scaffold.repository;
  const issues = await listAllIssues(client, owner, repo, scaffold.labels);
  const existing = pickMatchingIssue(issues, scaffold);
  const remoteFingerprint = extractFingerprint(existing?.body);
  const needsUpdate =
    !!existing &&
    (remoteFingerprint !== scaffold.fingerprint || existing.title !== scaffold.title || existing.state !== 'open');

  if (!existing) {
    if (dryRun) {
      return {
        scaffoldId: scaffold.id,
        dedupeKey: scaffold.dedupeKey,
        mode: scaffold.mode,
        status: 'dry_run',
        reason: 'would_create_issue',
        remote: null,
      };
    }

    const created = await client.request<GitHubIssue>(`POST`, `/repos/${owner}/${repo}/issues`, {
      title: scaffold.title,
      body: scaffold.body,
      labels: scaffold.labels,
    });
    return {
      scaffoldId: scaffold.id,
      dedupeKey: scaffold.dedupeKey,
      mode: scaffold.mode,
      status: 'created',
      reason: null,
      remote: buildRemoteTarget('issue', created),
    };
  }

  if (!needsUpdate) {
    if (existing.state !== 'open') {
      if (dryRun) {
        return {
          scaffoldId: scaffold.id,
          dedupeKey: scaffold.dedupeKey,
          mode: scaffold.mode,
          status: 'dry_run',
          reason: 'would_reopen_issue',
          remote: buildRemoteTarget('issue', existing),
        };
      }

      const reopened = await client.request<GitHubIssue>(`PATCH`, `/repos/${owner}/${repo}/issues/${existing.number}`, {
        state: 'open',
        title: scaffold.title,
        body: scaffold.body,
        labels: scaffold.labels,
      });
      return {
        scaffoldId: scaffold.id,
        dedupeKey: scaffold.dedupeKey,
        mode: scaffold.mode,
        status: 'reopened',
        reason: null,
        remote: buildRemoteTarget('issue', reopened),
      };
    }

    return {
      scaffoldId: scaffold.id,
      dedupeKey: scaffold.dedupeKey,
      mode: scaffold.mode,
      status: 'unchanged',
      reason: 'matching_issue_already_open',
      remote: buildRemoteTarget('issue', existing),
    };
  }

  if (dryRun) {
    return {
      scaffoldId: scaffold.id,
      dedupeKey: scaffold.dedupeKey,
      mode: scaffold.mode,
      status: 'dry_run',
      reason: existing.state === 'open' ? 'would_update_issue' : 'would_reopen_issue',
      remote: buildRemoteTarget('issue', existing),
    };
  }

  const updated = await client.request<GitHubIssue>(`PATCH`, `/repos/${owner}/${repo}/issues/${existing.number}`, {
    state: 'open',
    title: scaffold.title,
    body: scaffold.body,
    labels: scaffold.labels,
  });
  return {
    scaffoldId: scaffold.id,
    dedupeKey: scaffold.dedupeKey,
    mode: scaffold.mode,
    status: existing.state === 'open' ? 'updated' : 'reopened',
    reason: null,
    remote: buildRemoteTarget('issue', updated),
  };
}

async function syncPullRequestLabels(
  client: GitHubRestClient,
  scaffold: OperatorRemediationHandoffScaffold,
  number: number,
): Promise<void> {
  await client.request('PATCH', `/repos/${scaffold.repository.owner}/${scaffold.repository.repo}/issues/${number}`, {
    labels: scaffold.labels,
  });
}

async function publishPullRequestScaffold(
  client: GitHubRestClient,
  scaffold: OperatorRemediationHandoffScaffold,
  dryRun: boolean,
): Promise<OperatorRemediationHandoffPublicationEntry> {
  const { owner, repo, baseBranch } = scaffold.repository;
  const pulls = await listAllPullRequests(client, owner, repo);
  const existing = pickMatchingPullRequest(pulls, scaffold, owner);

  if (!existing) {
    if (!scaffold.branchName) {
      return {
        scaffoldId: scaffold.id,
        dedupeKey: scaffold.dedupeKey,
        mode: scaffold.mode,
        status: 'skipped',
        reason: 'pull_request_branch_missing',
        remote: null,
      };
    }

    const branchReady = await branchExists(client, owner, repo, scaffold.branchName);
    if (!branchReady) {
      return {
        scaffoldId: scaffold.id,
        dedupeKey: scaffold.dedupeKey,
        mode: scaffold.mode,
        status: 'skipped',
        reason: 'pull_request_head_branch_not_found',
        remote: null,
      };
    }

    if (dryRun) {
      return {
        scaffoldId: scaffold.id,
        dedupeKey: scaffold.dedupeKey,
        mode: scaffold.mode,
        status: 'dry_run',
        reason: 'would_create_pull_request',
        remote: null,
      };
    }

    const created = await client.request<GitHubDraftPrResponse>(`POST`, `/repos/${owner}/${repo}/pulls`, {
      title: scaffold.title,
      body: scaffold.body,
      head: scaffold.branchName,
      base: baseBranch,
      draft: true,
    });
    await syncPullRequestLabels(client, scaffold, created.number);
    return {
      scaffoldId: scaffold.id,
      dedupeKey: scaffold.dedupeKey,
      mode: scaffold.mode,
      status: 'created',
      reason: null,
      remote: buildRemoteTarget('pull_request', created),
    };
  }

  const remoteFingerprint = extractFingerprint(existing.body);
  const needsUpdate =
    remoteFingerprint !== scaffold.fingerprint || existing.title !== scaffold.title || existing.state !== 'open';

  if (!needsUpdate) {
    if (existing.state !== 'open') {
      if (dryRun) {
        return {
          scaffoldId: scaffold.id,
          dedupeKey: scaffold.dedupeKey,
          mode: scaffold.mode,
          status: 'dry_run',
          reason: 'would_reopen_pull_request',
          remote: buildRemoteTarget('pull_request', existing),
        };
      }

      const reopened = await client.request<GitHubIssue>('PATCH', `/repos/${owner}/${repo}/issues/${existing.number}`, {
        state: 'open',
      });
      await client.request<GitHubDraftPrResponse>('PATCH', `/repos/${owner}/${repo}/pulls/${existing.number}`, {
        title: scaffold.title,
        body: scaffold.body,
        base: baseBranch,
      });
      await syncPullRequestLabels(client, scaffold, existing.number);
      return {
        scaffoldId: scaffold.id,
        dedupeKey: scaffold.dedupeKey,
        mode: scaffold.mode,
        status: 'reopened',
        reason: null,
        remote: buildRemoteTarget('pull_request', reopened),
      };
    }

    return {
      scaffoldId: scaffold.id,
      dedupeKey: scaffold.dedupeKey,
      mode: scaffold.mode,
      status: 'unchanged',
      reason: 'matching_pull_request_already_open',
      remote: buildRemoteTarget('pull_request', existing),
    };
  }

  if (dryRun) {
    return {
      scaffoldId: scaffold.id,
      dedupeKey: scaffold.dedupeKey,
      mode: scaffold.mode,
      status: 'dry_run',
      reason: existing.state === 'open' ? 'would_update_pull_request' : 'would_reopen_pull_request',
      remote: buildRemoteTarget('pull_request', existing),
    };
  }

  if (existing.state !== 'open') {
    await client.request<GitHubIssue>('PATCH', `/repos/${owner}/${repo}/issues/${existing.number}`, { state: 'open' });
  }
  const updated = await client.request<GitHubDraftPrResponse>(
    'PATCH',
    `/repos/${owner}/${repo}/pulls/${existing.number}`,
    {
      title: scaffold.title,
      body: scaffold.body,
      base: baseBranch,
    },
  );
  await syncPullRequestLabels(client, scaffold, existing.number);
  return {
    scaffoldId: scaffold.id,
    dedupeKey: scaffold.dedupeKey,
    mode: scaffold.mode,
    status: existing.state === 'open' ? 'updated' : 'reopened',
    reason: null,
    remote: buildRemoteTarget('pull_request', updated),
  };
}

function summarize(
  entries: OperatorRemediationHandoffPublicationEntry[],
): OperatorRemediationHandoffPublicationReport['summary'] {
  return {
    actionable: entries.length > 0,
    attempted: entries.length,
    created: entries.filter((entry) => entry.status === 'created').length,
    updated: entries.filter((entry) => entry.status === 'updated').length,
    reopened: entries.filter((entry) => entry.status === 'reopened').length,
    unchanged: entries.filter((entry) => entry.status === 'unchanged').length,
    skipped: entries.filter((entry) => entry.status === 'skipped').length,
    failed: entries.filter((entry) => entry.status === 'failed').length,
    dryRun: entries.filter((entry) => entry.status === 'dry_run').length,
  };
}

function determineReportStatus(
  entries: OperatorRemediationHandoffPublicationEntry[],
): OperatorRemediationHandoffPublicationReport['status'] {
  const failed = entries.some((entry) => entry.status === 'failed');
  return failed ? 'partial' : 'completed';
}

export function loadOperatorRemediationHandoffReport(
  path: string = DEFAULT_OPS_HANDOFF_JSON_PATH,
): OperatorRemediationHandoffReport {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf-8')) as OperatorRemediationHandoffReport;
}

export async function publishOperatorRemediationHandoffReport(options: {
  handoffReport: OperatorRemediationHandoffReport;
  sourceReportPath?: string;
  githubToken?: string | null;
  apiBaseUrl?: string;
  dryRun?: boolean;
}): Promise<OperatorRemediationHandoffPublicationReport> {
  const handoffReport = options.handoffReport;
  const sourceReportPath = resolve(process.cwd(), options.sourceReportPath || DEFAULT_OPS_HANDOFF_JSON_PATH);
  const dryRun = options.dryRun === true;

  if (handoffReport.status === 'disabled' || handoffReport.mode === 'none') {
    return {
      generatedAt: new Date().toISOString(),
      status: 'disabled',
      dryRun,
      disabledReason: handoffReport.disabledReason || 'handoff_mode_disabled',
      sourceReportPath,
      repository: handoffReport.repository,
      mode: handoffReport.mode,
      summary: summarize([]),
      entries: [],
    };
  }

  if (handoffReport.scaffolds.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      status: 'completed',
      dryRun,
      disabledReason: null,
      sourceReportPath,
      repository: handoffReport.repository,
      mode: handoffReport.mode,
      summary: summarize([]),
      entries: [],
    };
  }

  const token = options.githubToken || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;
  if (!token) {
    return {
      generatedAt: new Date().toISOString(),
      status: 'disabled',
      dryRun,
      disabledReason: 'github_token_missing',
      sourceReportPath,
      repository: handoffReport.repository,
      mode: handoffReport.mode,
      summary: summarize([]),
      entries: [],
    };
  }

  const client = new GitHubRestClient({ token, apiBaseUrl: options.apiBaseUrl });
  const entries: OperatorRemediationHandoffPublicationEntry[] = [];

  for (const scaffold of handoffReport.scaffolds) {
    try {
      const entry =
        scaffold.mode === 'issue'
          ? await publishIssueScaffold(client, scaffold, dryRun)
          : await publishPullRequestScaffold(client, scaffold, dryRun);
      entries.push(entry);
    } catch (error) {
      entries.push({
        scaffoldId: scaffold.id,
        dedupeKey: scaffold.dedupeKey,
        mode: scaffold.mode,
        status: 'failed',
        reason: error instanceof Error ? error.message : String(error),
        remote: null,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    status: determineReportStatus(entries),
    dryRun,
    disabledReason: null,
    sourceReportPath,
    repository: handoffReport.repository,
    mode: handoffReport.mode,
    summary: summarize(entries),
    entries,
  };
}

export function renderOperatorRemediationHandoffPublicationReport(
  report: OperatorRemediationHandoffPublicationReport,
): string {
  const repositoryTarget =
    report.repository.owner && report.repository.repo
      ? `${report.repository.owner}/${report.repository.repo}${report.repository.baseBranch ? ` @ ${report.repository.baseBranch}` : ''}`
      : 'n/a';

  const lines = [
    '# Operator Remediation Handoff Publication',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Dry run: ${report.dryRun ? 'yes' : 'no'}`,
    `- Disabled reason: ${report.disabledReason || 'n/a'}`,
    `- Source report: ${report.sourceReportPath}`,
    `- Repository: ${repositoryTarget}`,
    `- Mode: ${report.mode}`,
    `- Actions: attempted=${report.summary.attempted}, created=${report.summary.created}, updated=${report.summary.updated}, reopened=${report.summary.reopened}, unchanged=${report.summary.unchanged}, skipped=${report.summary.skipped}, failed=${report.summary.failed}, dry-run=${report.summary.dryRun}`,
    '',
    '## Publication Results',
    '',
  ];

  if (report.entries.length === 0) {
    lines.push('- No handoff publications were attempted.');
    return lines.join('\n');
  }

  for (const entry of report.entries) {
    const remote = entry.remote ? `${entry.remote.kind} #${entry.remote.number} (${entry.remote.url})` : 'n/a';
    lines.push(`- [${entry.status.toUpperCase()}][${entry.mode}] ${entry.scaffoldId}`);
    lines.push(`  dedupe: ${entry.dedupeKey}`);
    lines.push(`  remote: ${remote}`);
    if (entry.reason) {
      lines.push(`  reason: ${entry.reason}`);
    }
  }

  return lines.join('\n');
}

export function writeOperatorRemediationHandoffPublicationReport(
  report: OperatorRemediationHandoffPublicationReport,
  options?: {
    outputPath?: string;
    jsonOutputPath?: string;
  },
): void {
  const outputPath = resolve(process.cwd(), options?.outputPath || DEFAULT_OPS_HANDOFF_PUBLICATION_MD_PATH);
  const jsonOutputPath = resolve(process.cwd(), options?.jsonOutputPath || DEFAULT_OPS_HANDOFF_PUBLICATION_JSON_PATH);

  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(jsonOutputPath), { recursive: true });
  writeFileSync(outputPath, renderOperatorRemediationHandoffPublicationReport(report));
  writeFileSync(jsonOutputPath, JSON.stringify(report, null, 2));
}
