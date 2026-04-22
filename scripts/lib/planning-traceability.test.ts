import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  archivePlanningTraceabilityArtifacts,
  buildPlanningTraceabilityReport,
  renderPlanningTraceabilityReport,
} from './planning-traceability';

function write(root: string, relativePath: string, content: string) {
  const fullPath = join(root, relativePath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, content);
}

describe('planning traceability report', () => {
  it('computes active milestone requirement coverage from summary and verification frontmatter', () => {
    const root = mkdtempSync(join(tmpdir(), 'planning-traceability-'));

    write(
      root,
      '.planning/STATE.md',
      `---
milestone: v1.1
milestone_name: Observability and Governance Hardening
---
`,
    );

    write(
      root,
      '.planning/REQUIREMENTS.md',
      `# Requirements

## v1.1 Requirements

- [x] **AIOPS-01**: Provider health is visible.
- [x] **AIOPS-02**: Threshold blocking exists.
- [ ] **TRACE-01**: Machine-readable summary coverage.

## v1.2+ Requirements
`,
    );

    write(
      root,
      '.planning/ROADMAP.md',
      `# Roadmap

### Phase 31: provider-telemetry-and-alerting
**Requirements**: AIOPS-01, AIOPS-02

### Phase 33: planning-traceability-and-phase-hygiene
**Requirements**: TRACE-01

## Progress
`,
    );

    write(
      root,
      '.planning/phases/31-provider-telemetry-and-alerting/31-01-SUMMARY.md',
      `---
phase: 31-provider-telemetry-and-alerting
requirements_completed:
  - AIOPS-01
  - AIOPS-02
---
summary
`,
    );

    write(
      root,
      '.planning/phases/31-provider-telemetry-and-alerting/31-VERIFICATION.md',
      `---
phase: 31-provider-telemetry-and-alerting
requirements_completed:
  - AIOPS-01
  - AIOPS-02
---
verification
`,
    );

    write(root, '.planning/phases/01-resolve-ui/01-01-SUMMARY.md', 'legacy');
    write(root, '.planning/phases/audit-comprehensive/AUDIT.md', 'orphan');

    const report = buildPlanningTraceabilityReport({
      rootDir: root,
      generatedAt: '2026-04-06T15:10:00.000Z',
    });

    expect(report.requirements).toEqual([
      {
        id: 'AIOPS-01',
        expectedPhase: '31',
        summaryEvidence: true,
        verificationEvidence: true,
        status: 'satisfied',
      },
      {
        id: 'AIOPS-02',
        expectedPhase: '31',
        summaryEvidence: true,
        verificationEvidence: true,
        status: 'satisfied',
      },
      {
        id: 'TRACE-01',
        expectedPhase: '33',
        summaryEvidence: false,
        verificationEvidence: false,
        status: 'pending',
      },
    ]);

    expect(report.hygiene.legacyPhaseDirs).toEqual(['01-resolve-ui']);
    expect(report.hygiene.orphanPhaseDirs).toEqual(['audit-comprehensive']);
    expect(report.hygiene.status).toBe('warning');
  });

  it('renders markdown with phase contract and hygiene details', () => {
    const root = mkdtempSync(join(tmpdir(), 'planning-traceability-render-'));

    write(
      root,
      '.planning/STATE.md',
      `---
milestone: v1.1
milestone_name: Observability and Governance Hardening
---
`,
    );

    write(
      root,
      '.planning/REQUIREMENTS.md',
      `# Requirements

## v1.1 Requirements

- [ ] **TRACE-01**: Machine-readable summary coverage.

## v1.2+ Requirements
`,
    );

    write(
      root,
      '.planning/ROADMAP.md',
      `# Roadmap

### Phase 33: planning-traceability-and-phase-hygiene
**Requirements**: TRACE-01

## Progress
`,
    );

    write(
      root,
      '.planning/phases/33-planning-traceability-and-phase-hygiene/33-01-SUMMARY.md',
      `---
phase: 33-planning-traceability-and-phase-hygiene
requirements_completed:
  - TRACE-01
---
summary
`,
    );

    write(
      root,
      '.planning/phases/33-planning-traceability-and-phase-hygiene/33-VERIFICATION.md',
      `---
phase: 33-planning-traceability-and-phase-hygiene
requirements_completed:
  - TRACE-01
---
verification
`,
    );

    const report = buildPlanningTraceabilityReport({
      rootDir: root,
      generatedAt: '2026-04-06T15:10:00.000Z',
    });
    const markdown = renderPlanningTraceabilityReport(report);

    expect(markdown).toContain('# Planning Traceability Report');
    expect(markdown).toContain('TRACE-01');
    expect(markdown).toContain(
      '| 33 | 33-planning-traceability-and-phase-hygiene | ready | ready | TRACE-01 | TRACE-01 |',
    );
    expect(markdown).toContain('- Orphan phase dirs: none');
  });

  it('keeps requirement coverage when the active milestone section is the last section in the file', () => {
    const root = mkdtempSync(join(tmpdir(), 'planning-traceability-eof-'));

    write(
      root,
      '.planning/STATE.md',
      `---
milestone: v1.2
milestone_name: Operator Automation and Runtime Convergence
---
`,
    );

    write(
      root,
      '.planning/REQUIREMENTS.md',
      `# Requirements

## v1.2 Requirements

- [x] **TRACE-04**: Milestone bootstrap and closeout support exists.
`,
    );

    write(
      root,
      '.planning/ROADMAP.md',
      `# Roadmap

### Phase 38: planning-bootstrap-and-closeout-automation
**Requirements**: TRACE-04

## Progress
`,
    );

    write(
      root,
      '.planning/phases/38-planning-bootstrap-and-closeout-automation/38-01-SUMMARY.md',
      `---
phase: 38-planning-bootstrap-and-closeout-automation
requirements_completed:
  - TRACE-04
---
summary
`,
    );

    write(
      root,
      '.planning/phases/38-planning-bootstrap-and-closeout-automation/38-VERIFICATION.md',
      `---
phase: 38-planning-bootstrap-and-closeout-automation
requirements_completed:
  - TRACE-04
---
verification
`,
    );

    const report = buildPlanningTraceabilityReport({
      rootDir: root,
      generatedAt: '2026-04-07T03:10:00.000Z',
    });

    expect(report.requirements).toEqual([
      {
        id: 'TRACE-04',
        expectedPhase: '38',
        summaryEvidence: true,
        verificationEvidence: true,
        status: 'satisfied',
      },
    ]);
  });

  it('renders a clean between-milestones report when no active milestone is defined', () => {
    const root = mkdtempSync(join(tmpdir(), 'planning-traceability-between-'));

    write(
      root,
      '.planning/STATE.md',
      `---
status: planning_next_milestone
---
`,
    );

    write(
      root,
      '.planning/REQUIREMENTS.md',
      `# Requirements

## No Active Milestone

Carry-forward ideas only.
`,
    );

    write(
      root,
      '.planning/ROADMAP.md',
      `# Roadmap

## Next Milestone Setup

No active milestone is defined yet.
`,
    );

    const report = buildPlanningTraceabilityReport({
      rootDir: root,
      generatedAt: '2026-04-07T05:40:00.000Z',
    });
    const markdown = renderPlanningTraceabilityReport(report);

    expect(report.milestone).toBeNull();
    expect(report.requirements).toEqual([]);
    expect(report.activePhases).toEqual([]);
    expect(markdown).toContain('No active milestone requirements are currently defined.');
    expect(markdown).toContain('No active phases are currently mapped in `.planning/ROADMAP.md`.');
    expect(markdown).not.toContain('| n/a | n/a | pending | no | no |');
  });

  it('maps roadmap requirements when the roadmap uses bold-colon markdown with backticked ids', () => {
    const root = mkdtempSync(join(tmpdir(), 'planning-traceability-roadmap-format-'));

    write(
      root,
      '.planning/STATE.md',
      `---
milestone: v1.4
milestone_name: Traffic Recovery Closure
---
`,
    );

    write(
      root,
      '.planning/REQUIREMENTS.md',
      `# Requirements

## v1.4 Requirements

- [x] **SEO-11**: Crawl quality stays inside the weekly threshold.
- [x] **AIOPS-11**: Provider posture remains explicit and guarded.
`,
    );

    write(
      root,
      '.planning/ROADMAP.md',
      `# Roadmap

### Phase 43: production-sitemap-and-dynamic-404-closure
**Requirements:** \`SEO-11\`

### Phase 45: provider-resilience-under-recovery-guardrails
**Requirements:** \`AIOPS-11\`

## Progress
`,
    );

    write(
      root,
      '.planning/phases/43-production-sitemap-and-dynamic-404-closure/43-01-SUMMARY.md',
      `---
phase: 43-production-sitemap-and-dynamic-404-closure
requirements_completed:
  - SEO-11
---
`,
    );
    write(
      root,
      '.planning/phases/43-production-sitemap-and-dynamic-404-closure/43-VERIFICATION.md',
      `---
phase: 43-production-sitemap-and-dynamic-404-closure
requirements_completed:
  - SEO-11
---
`,
    );
    write(
      root,
      '.planning/phases/45-provider-resilience-under-recovery-guardrails/45-01-SUMMARY.md',
      `---
phase: 45-provider-resilience-under-recovery-guardrails
requirements_completed:
  - AIOPS-11
---
`,
    );
    write(
      root,
      '.planning/phases/45-provider-resilience-under-recovery-guardrails/45-VERIFICATION.md',
      `---
phase: 45-provider-resilience-under-recovery-guardrails
requirements_completed:
  - AIOPS-11
---
`,
    );

    const report = buildPlanningTraceabilityReport({
      rootDir: root,
      generatedAt: '2026-04-09T06:55:00.000Z',
    });

    expect(report.requirements).toEqual([
      {
        id: 'SEO-11',
        expectedPhase: '43',
        summaryEvidence: true,
        verificationEvidence: true,
        status: 'satisfied',
      },
      {
        id: 'AIOPS-11',
        expectedPhase: '45',
        summaryEvidence: true,
        verificationEvidence: true,
        status: 'satisfied',
      },
    ]);
  });

  it('archives the latest active traceability snapshot into milestone-scoped artifacts', () => {
    const root = mkdtempSync(join(tmpdir(), 'planning-traceability-archive-'));

    write(
      root,
      '.planning/traceability/latest-milestone-traceability.md',
      `# Planning Traceability Report

- Milestone: v1.3 (Adaptive Provider Control and Escalation Automation)
- Generated: 2026-04-07T08:39:56.840Z
- Requirement coverage: satisfied=6, partial=0, pending=0
`,
    );

    write(
      root,
      '.planning/traceability/latest-milestone-traceability.json',
      JSON.stringify(
        {
          milestone: 'v1.3',
          milestoneName: 'Adaptive Provider Control and Escalation Automation',
          requirements: [],
        },
        null,
        2,
      ),
    );

    const archived = archivePlanningTraceabilityArtifacts({ rootDir: root });

    expect(archived).toEqual({
      milestone: 'v1.3',
      markdownPath: '.planning/milestones/v1.3-TRACEABILITY.md',
      jsonPath: '.planning/milestones/v1.3-TRACEABILITY.json',
    });
    expect(existsSync(join(root, '.planning/milestones/v1.3-TRACEABILITY.md'))).toBe(true);
    expect(existsSync(join(root, '.planning/milestones/v1.3-TRACEABILITY.json'))).toBe(true);
    expect(readFileSync(join(root, '.planning/milestones/v1.3-TRACEABILITY.md'), 'utf8')).toContain(
      '- Milestone: v1.3',
    );
    expect(JSON.parse(readFileSync(join(root, '.planning/milestones/v1.3-TRACEABILITY.json'), 'utf8'))).toMatchObject({
      milestone: 'v1.3',
    });
  });
});
