import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildOperatorRemediationHandoffReport, buildOperatorRemediationReport } from './operator-ops-summary';
import { publishOperatorRemediationHandoffReport } from './operator-ops-handoff';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function buildWarningHandoff(mode: 'issue' | 'pull_request' = 'issue') {
  const remediation = buildOperatorRemediationReport({
    aiThreshold: 'warning',
    governanceThreshold: 'warning',
    generatedAt: '2026-04-07T00:00:00.000Z',
    aiHealthReport: {
      generatedAt: '2026-04-07T00:00:00.000Z',
      gate: {
        failOnSeverity: 'critical',
        blocking: false,
        blockingAlertCount: 0,
        blockingAlertCodes: [],
        blockingAlertTitles: [],
      },
      alertSummary: {
        total: 1,
        warningCount: 1,
        criticalCount: 0,
        highestSeverity: 'warning',
        status: 'soft warning',
      },
      alerts: [
        {
          severity: 'warning',
          code: 'nvidia_instability_window',
          title: 'Historical NVIDIA volatility detected',
          detail: 'Recent 429 pressure remains noisy.',
        },
      ],
    } as any,
    contentGovernanceReport: {
      generatedAt: '2026-04-07T00:00:00.000Z',
      severity: 'clear',
      gate: { failOnSeverity: 'blocking', blocking: false, triggeredChecks: [] },
      checks: [],
    } as any,
  });

  return buildOperatorRemediationHandoffReport({
    remediationReport: remediation,
    generatedAt: '2026-04-07T00:00:00.000Z',
    mode,
    owner: 'asiawright1122-boop',
    repo: 'Killer-AgentSkills',
    baseBranch: 'main',
    labels: ['ops-remediation', 'automated'],
  });
}

describe('operator ops handoff publisher', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a new GitHub issue for a new scaffold', async () => {
    const handoff = buildWarningHandoff('issue');
    const scaffold = handoff.scaffolds[0];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            number: 42,
            html_url: 'https://github.com/asiawright1122-boop/Killer-AgentSkills/issues/42',
            state: 'open',
            title: scaffold.title,
            body: scaffold.body,
          },
          201,
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const report = await publishOperatorRemediationHandoffReport({
      handoffReport: handoff,
      githubToken: 'test-token',
    });

    expect(report.status).toBe('completed');
    expect(report.summary.created).toBe(1);
    expect(report.entries[0].status).toBe('created');
    expect(report.entries[0].remote?.number).toBe(42);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps repeat issues unchanged instead of opening duplicates', async () => {
    const handoff = buildWarningHandoff('issue');
    const scaffold = handoff.scaffolds[0];
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse([
        {
          number: 42,
          html_url: 'https://github.com/asiawright1122-boop/Killer-AgentSkills/issues/42',
          state: 'open',
          title: scaffold.title,
          body: scaffold.body,
        },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const report = await publishOperatorRemediationHandoffReport({
      handoffReport: handoff,
      githubToken: 'test-token',
    });

    expect(report.summary.unchanged).toBe(1);
    expect(report.entries[0].status).toBe('unchanged');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reopens and updates a closed issue when the scaffold fingerprint changes', async () => {
    const handoff = buildWarningHandoff('issue');
    const updatedScaffold = {
      ...handoff.scaffolds[0],
      fingerprint: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      title: '[OPS][WARNING] Historical NVIDIA volatility detected (updated)',
      body: `${handoff.scaffolds[0].body}\n\nAdditional evidence attached.`,
    };
    const updatedReport = {
      ...handoff,
      scaffolds: [updatedScaffold],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            number: 42,
            html_url: 'https://github.com/asiawright1122-boop/Killer-AgentSkills/issues/42',
            state: 'closed',
            title: handoff.scaffolds[0].title,
            body: handoff.scaffolds[0].body,
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          number: 42,
          html_url: 'https://github.com/asiawright1122-boop/Killer-AgentSkills/issues/42',
          state: 'open',
          title: updatedScaffold.title,
          body: updatedScaffold.body,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const report = await publishOperatorRemediationHandoffReport({
      handoffReport: updatedReport,
      githubToken: 'test-token',
    });

    expect(report.summary.reopened).toBe(1);
    expect(report.entries[0].status).toBe('reopened');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('skips pull request publication when the suggested head branch does not exist', async () => {
    const handoff = buildWarningHandoff('pull_request');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(new Response('Not Found', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const report = await publishOperatorRemediationHandoffReport({
      handoffReport: handoff,
      githubToken: 'test-token',
    });

    expect(report.summary.skipped).toBe(1);
    expect(report.entries[0].status).toBe('skipped');
    expect(report.entries[0].reason).toBe('pull_request_head_branch_not_found');
  });
});
