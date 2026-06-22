import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  buildPlanningMilestoneSupportReport,
  renderMilestoneBootstrapReport,
  renderMilestoneCloseoutReport,
  renderMilestonesIndex,
  writePlanningMilestoneSupportArtifacts,
} from './planning-milestone-support';

function write(root: string, relativePath: string, content: string) {
  const fullPath = join(root, relativePath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, content);
}

describe('planning milestone support', () => {
  it('builds active milestone bootstrap, closeout, and shipped registry entries from planning artifacts', () => {
    const root = mkdtempSync(join(tmpdir(), 'planning-milestones-'));

    write(
      root,
      '.planning/PROJECT.md',
      `# Demo Project

## Current Milestone: v1.2 Operator Automation and Runtime Convergence

**Goal:** Finish the operator automation lane and make milestone transitions reproducible.
`,
    );

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

- [x] **AIOPS-05**: Longer-window provider guidance exists.
- [x] **TRACE-04**: Milestone bootstrap and closeout are automated.
`,
    );

    write(
      root,
      '.planning/ROADMAP.md',
      `# Roadmap

### Phase 35: provider-history-and-runtime-convergence
**Requirements**: AIOPS-05
**Plans**: 1/1 completed

### Phase 38: planning-bootstrap-and-closeout-automation
**Requirements**: TRACE-04
**Plans**: 1/1 completed

## Progress
`,
    );

    write(
      root,
      '.planning/phases/35-provider-history-and-runtime-convergence/35-01-SUMMARY.md',
      `---
phase: 35-provider-history-and-runtime-convergence
requirements_completed:
  - AIOPS-05
---
`,
    );
    write(
      root,
      '.planning/phases/35-provider-history-and-runtime-convergence/35-VERIFICATION.md',
      `---
phase: 35-provider-history-and-runtime-convergence
requirements_completed:
  - AIOPS-05
---
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
`,
    );

    write(
      root,
      '.planning/milestones/v1.1-ROADMAP.md',
      `# Milestone v1.1: Observability and Governance Hardening

**Status:** SHIPPED 2026-04-06
**Audit:** [v1.1-MILESTONE-AUDIT.md](./v1.1-MILESTONE-AUDIT.md)
**Phases:** 31-34
**Total Plans:** 4

## Overview

This milestone hardened the operator lane.

## Milestone Summary

### Key Accomplishments

1. Added provider health reporting.
2. Added planning traceability.
`,
    );

    write(
      root,
      '.planning/milestones/v1.1-REQUIREMENTS.md',
      `# Milestone v1.1 Requirements Archive

## Carry-Forward Candidates

- **AIOPS-05**: Provider selection can self-tune based on longer-window success rates.
- **TRACE-04**: Milestone bootstrap and closeout flows create all planning index files automatically.
`,
    );

    write(root, '.planning/milestones/v1.1-MILESTONE-AUDIT.md', '# audit');
    write(
      root,
      '.planning/milestones/v1.2-ROADMAP.md',
      `# Milestone v1.2: Operator Automation and Runtime Convergence

**Status:** AUDITED 2026-04-07
**Phases:** 35-38
**Total Plans:** 4
`,
    );
    write(root, '.planning/milestones/v1.2-REQUIREMENTS.md', '# Milestone v1.2 Requirements Archive');

    const report = buildPlanningMilestoneSupportReport({
      rootDir: root,
      generatedAt: '2026-04-07T03:00:00.000Z',
    });

    expect(report.activeMilestone?.version).toBe('v1.2');
    expect(report.bootstrap?.sourceMilestone).toBe('v1.1');
    expect(report.bootstrap?.carriedForward).toEqual([
      '**AIOPS-05**: Provider selection can self-tune based on longer-window success rates.',
      '**TRACE-04**: Milestone bootstrap and closeout flows create all planning index files automatically.',
    ]);
    expect(report.closeout?.status).toBe('ready');
    expect(report.closeout?.phaseCounts).toEqual({ total: 2, completed: 2 });
    expect(report.closeout?.requirementCounts.satisfied).toBe(2);
    expect(report.activeMilestone?.totalPlans).toBe(2);
    expect(report.archivedMilestones[0]?.version).toBe('v1.1');
    expect(report.archivedMilestones[0]?.accomplishments).toEqual([
      'Added provider health reporting.',
      'Added planning traceability.',
    ]);

    const indexMarkdown = renderMilestonesIndex(report);
    const bootstrapMarkdown = renderMilestoneBootstrapReport(report);
    const closeoutMarkdown = renderMilestoneCloseoutReport(report);

    expect(indexMarkdown).toContain('## Active Milestone');
    expect(indexMarkdown).toContain('v1.2 Operator Automation and Runtime Convergence');
    expect(indexMarkdown).toContain('## Shipped Milestones');
    expect(bootstrapMarkdown).toContain('Milestone v1.2 Bootstrap Reference');
    expect(bootstrapMarkdown).toContain('.planning/phase-lifecycle/latest-phase-lifecycle.md');
    expect(bootstrapMarkdown).toContain('.planning/STATE.md');
    expect(closeoutMarkdown).toContain('Status: ready');
    expect(closeoutMarkdown).toContain('.planning/milestones/v1.2-phases');
    expect(closeoutMarkdown).toContain('.planning/milestones/v1.2-MILESTONE-AUDIT.md');
  });

  it('writes registry, bootstrap, and closeout artifacts to milestone paths', () => {
    const root = mkdtempSync(join(tmpdir(), 'planning-milestones-write-'));

    write(root, '.planning/PROJECT.md', '# Demo Project');
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

- [x] **TRACE-04**: Automated milestone support exists.
`,
    );
    write(
      root,
      '.planning/ROADMAP.md',
      `# Roadmap

### Phase 38: planning-bootstrap-and-closeout-automation
**Requirements**: TRACE-04
**Plans**: 1/1 completed

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
`,
    );

    const report = buildPlanningMilestoneSupportReport({
      rootDir: root,
      generatedAt: '2026-04-07T03:00:00.000Z',
    });

    writePlanningMilestoneSupportArtifacts(report);

    expect(existsSync(join(root, '.planning/MILESTONES.md'))).toBe(true);
    expect(existsSync(join(root, '.planning/milestones/v1.2-BOOTSTRAP.md'))).toBe(true);
    expect(existsSync(join(root, '.planning/milestones/v1.2-BOOTSTRAP.json'))).toBe(true);
    expect(existsSync(join(root, '.planning/milestones/v1.2-CLOSEOUT.md'))).toBe(true);
    expect(existsSync(join(root, '.planning/milestones/v1.2-CLOSEOUT.json'))).toBe(true);
    expect(readFileSync(join(root, '.planning/MILESTONES.md'), 'utf8')).toContain('v1.2');
  });

  it('parses roadmap phase requirements and plan totals when roadmap lines use bold-colon markdown', () => {
    const root = mkdtempSync(join(tmpdir(), 'planning-milestones-roadmap-format-'));

    write(
      root,
      '.planning/PROJECT.md',
      `# Demo Project

## Current Milestone: v1.4 Traffic Recovery Closure

**Goal:** Close technical recovery work with auditable operator evidence.
`,
    );

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

- [x] **SEO-11**: Crawl quality stays inside the threshold.
- [x] **AIOPS-11**: Provider posture remains explicit and guarded.
`,
    );
    write(
      root,
      '.planning/ROADMAP.md',
      `# Roadmap

### Phase 43: production-sitemap-and-dynamic-404-closure
**Requirements:** \`SEO-11\`
**Plans:** 1/1 complete

### Phase 45: provider-resilience-under-recovery-guardrails
**Requirements:** \`AIOPS-11\`
**Plans:** 1/1 complete

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
    write(
      root,
      '.planning/milestones/v1.3-ROADMAP.md',
      `# Milestone v1.3: Adaptive Provider Control and Escalation Automation

**Status:** SHIPPED 2026-04-07
**Phases:** 39-42
**Total Plans:** 4
`,
    );
    write(root, '.planning/milestones/v1.3-REQUIREMENTS.md', '# Milestone v1.3 Requirements Archive');
    write(root, '.planning/milestones/v1.3-MILESTONE-AUDIT.md', '---\nstatus: passed\n---\n');

    const report = buildPlanningMilestoneSupportReport({
      rootDir: root,
      generatedAt: '2026-04-09T06:55:00.000Z',
    });

    expect(report.activeMilestone?.totalPlans).toBe(2);
    expect(report.bootstrap?.phases).toEqual([
      {
        number: '43',
        slug: 'production-sitemap-and-dynamic-404-closure',
        requirements: ['SEO-11'],
      },
      {
        number: '45',
        slug: 'provider-resilience-under-recovery-guardrails',
        requirements: ['AIOPS-11'],
      },
    ]);
  });

  it('parses roadmap phase requirements and plan totals when phase fields are list items', () => {
    const root = mkdtempSync(join(tmpdir(), 'planning-milestones-list-fields-'));

    write(root, '.planning/PROJECT.md', '# Demo Project');
    write(
      root,
      '.planning/STATE.md',
      `---
milestone: v3.8
milestone_name: Backlog Content Enrichment Automation
---
`,
    );
    write(
      root,
      '.planning/REQUIREMENTS.md',
      `# Requirements

## v3.8 Requirements

- [x] **AIOPS-37**: Enforce parity.
- [x] **AIOPS-38**: Validate scorecards.
`,
    );
    write(
      root,
      '.planning/ROADMAP.md',
      `# Roadmap

### Phase 116: Translation Parity & Punctuation Guardrails
- **Requirements:** AIOPS-37
- **Status:** Complete
- **Plans:** 1/1 complete

### Phase 117: Scorecard Promotion Verification
- **Requirements:** AIOPS-38
- **Status:** Complete
- **Plans:** 1/1 complete
`,
    );
    write(
      root,
      '.planning/phases/116-translation-parity-punctuation-guardrails/116-01-SUMMARY.md',
      `---
phase: 116-translation-parity-punctuation-guardrails
requirements_completed:
  - AIOPS-37
---
`,
    );
    write(
      root,
      '.planning/phases/116-translation-parity-punctuation-guardrails/116-VERIFICATION.md',
      `---
phase: 116-translation-parity-punctuation-guardrails
requirements_completed:
  - AIOPS-37
---
`,
    );
    write(
      root,
      '.planning/phases/117-scorecard-promotion-verification/117-01-SUMMARY.md',
      `---
phase: 117-scorecard-promotion-verification
requirements_completed:
  - AIOPS-38
---
`,
    );
    write(
      root,
      '.planning/phases/117-scorecard-promotion-verification/117-VERIFICATION.md',
      `---
phase: 117-scorecard-promotion-verification
requirements_completed:
  - AIOPS-38
---
`,
    );

    const report = buildPlanningMilestoneSupportReport({
      rootDir: root,
      generatedAt: '2026-06-09T12:05:00.000Z',
    });

    expect(report.activeMilestone?.totalPlans).toBe(2);
    expect(report.bootstrap?.phases.map((phase) => phase.requirements)).toEqual([['AIOPS-37'], ['AIOPS-38']]);
  });
});
