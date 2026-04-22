import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  buildPlanningPhaseLifecycleReport,
  renderPlanningPhaseLifecycleReport,
  syncPlanningPhaseLifecycle,
} from './planning-phase-lifecycle';

function write(root: string, relativePath: string, content: string) {
  const fullPath = join(root, relativePath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, content);
}

describe('planning phase lifecycle', () => {
  it('plans archive, restore, and create actions from milestone state', () => {
    const root = mkdtempSync(join(tmpdir(), 'planning-phase-lifecycle-plan-'));

    write(
      root,
      '.planning/STATE.md',
      `---
milestone: v1.3
milestone_name: Adaptive Provider Control and Escalation Automation
---
`,
    );
    write(
      root,
      '.planning/ROADMAP.md',
      `# Roadmap

### Phase 39: workload-aware-provider-routing-and-budget-guards
**Requirements**: AIOPS-08

### Phase 40: rate-pressure-evidence-and-operator-controls
**Requirements**: AIOPS-09

### Phase 42: phase-archive-lifecycle-automation
**Requirements**: TRACE-05

## Progress
`,
    );
    write(
      root,
      '.planning/milestones/v1.2-ROADMAP.md',
      `# Milestone v1.2: Operator Automation and Runtime Convergence

### Phase 35: provider-history-and-runtime-convergence
**Requirements**: AIOPS-05
`,
    );
    write(root, '.planning/phases/35-provider-history-and-runtime-convergence/35-01-SUMMARY.md', 'summary');
    write(root, '.planning/phases/39-workload-aware-provider-routing-and-budget-guards/39-01-SUMMARY.md', 'summary');
    write(
      root,
      '.planning/milestones/v1.3-phases/40-rate-pressure-evidence-and-operator-controls/40-01-SUMMARY.md',
      'summary',
    );

    const report = buildPlanningPhaseLifecycleReport({
      rootDir: root,
      generatedAt: '2026-04-07T08:10:00.000Z',
    });

    expect(report.status).toBe('pending');
    expect(report.archiveActions).toEqual([
      {
        type: 'archive',
        milestone: 'v1.2',
        phaseNumber: '35',
        slug: 'provider-history-and-runtime-convergence',
        dirName: '35-provider-history-and-runtime-convergence',
        fromPath: '.planning/phases/35-provider-history-and-runtime-convergence',
        toPath: '.planning/milestones/v1.2-phases/35-provider-history-and-runtime-convergence',
        reason: 'Shipped milestone phase directory is still in the active path and should be archived.',
      },
    ]);
    expect(report.restoreActions).toEqual([
      {
        type: 'restore',
        milestone: 'v1.3',
        phaseNumber: '40',
        slug: 'rate-pressure-evidence-and-operator-controls',
        dirName: '40-rate-pressure-evidence-and-operator-controls',
        fromPath: '.planning/milestones/v1.3-phases/40-rate-pressure-evidence-and-operator-controls',
        toPath: '.planning/phases/40-rate-pressure-evidence-and-operator-controls',
        reason: 'Active milestone phase exists only in the archive path and must be restored.',
      },
    ]);
    expect(report.createActions).toEqual([
      {
        type: 'create',
        milestone: 'v1.3',
        phaseNumber: '42',
        slug: 'phase-archive-lifecycle-automation',
        dirName: '42-phase-archive-lifecycle-automation',
        fromPath: null,
        toPath: '.planning/phases/42-phase-archive-lifecycle-automation',
        reason: 'Active milestone phase directory is missing and should be created.',
      },
    ]);
    expect(renderPlanningPhaseLifecycleReport(report)).toContain('Pending actions: 3');
  });

  it('archives shipped phase dirs, restores active dirs, rewrites references, and creates missing active directories', () => {
    const root = mkdtempSync(join(tmpdir(), 'planning-phase-lifecycle-sync-'));

    write(
      root,
      '.planning/STATE.md',
      `---
milestone: v1.3
milestone_name: Adaptive Provider Control and Escalation Automation
---
`,
    );
    write(
      root,
      '.planning/ROADMAP.md',
      `# Roadmap

### Phase 39: workload-aware-provider-routing-and-budget-guards
**Requirements**: AIOPS-08

### Phase 40: rate-pressure-evidence-and-operator-controls
**Requirements**: AIOPS-09

### Phase 42: phase-archive-lifecycle-automation
**Requirements**: TRACE-05

## Progress
`,
    );
    write(
      root,
      '.planning/milestones/v1.2-ROADMAP.md',
      `# Milestone v1.2: Operator Automation and Runtime Convergence

### Phase 35: provider-history-and-runtime-convergence
**Requirements**: AIOPS-05
`,
    );
    write(
      root,
      '.planning/milestones/v1.2-CLOSEOUT.md',
      '.planning/phases/35-provider-history-and-runtime-convergence/35-01-SUMMARY.md\n',
    );
    write(
      root,
      '.planning/phases/35-provider-history-and-runtime-convergence/35-01-SUMMARY.md',
      '.planning/phases/35-provider-history-and-runtime-convergence/35-01-SUMMARY.md\n',
    );
    write(root, '.planning/phases/39-workload-aware-provider-routing-and-budget-guards/39-01-SUMMARY.md', 'summary');
    write(
      root,
      '.planning/milestones/v1.3-phases/40-rate-pressure-evidence-and-operator-controls/40-01-SUMMARY.md',
      '.planning/milestones/v1.3-phases/40-rate-pressure-evidence-and-operator-controls/40-01-SUMMARY.md\n',
    );

    const report = syncPlanningPhaseLifecycle({
      rootDir: root,
      generatedAt: '2026-04-07T08:15:00.000Z',
    });

    expect(report.status).toBe('clean');
    expect(existsSync(join(root, '.planning/milestones/v1.2-phases/35-provider-history-and-runtime-convergence'))).toBe(
      true,
    );
    expect(existsSync(join(root, '.planning/phases/35-provider-history-and-runtime-convergence'))).toBe(false);
    expect(existsSync(join(root, '.planning/phases/40-rate-pressure-evidence-and-operator-controls'))).toBe(true);
    expect(
      existsSync(join(root, '.planning/milestones/v1.3-phases/40-rate-pressure-evidence-and-operator-controls')),
    ).toBe(false);
    expect(existsSync(join(root, '.planning/phases/42-phase-archive-lifecycle-automation'))).toBe(true);

    const closeout = readFileSync(join(root, '.planning/milestones/v1.2-CLOSEOUT.md'), 'utf8');
    expect(closeout).toContain(
      '.planning/milestones/v1.2-phases/35-provider-history-and-runtime-convergence/35-01-SUMMARY.md',
    );

    const restoredSummary = readFileSync(
      join(root, '.planning/phases/40-rate-pressure-evidence-and-operator-controls/40-01-SUMMARY.md'),
      'utf8',
    );
    expect(restoredSummary).toContain(
      '.planning/phases/40-rate-pressure-evidence-and-operator-controls/40-01-SUMMARY.md',
    );
    expect(report.rewrittenFiles).toEqual([
      '.planning/milestones/v1.2-CLOSEOUT.md',
      '.planning/milestones/v1.2-phases/35-provider-history-and-runtime-convergence/35-01-SUMMARY.md',
      '.planning/phases/40-rate-pressure-evidence-and-operator-controls/40-01-SUMMARY.md',
    ]);
    expect(existsSync(join(root, '.planning/phase-lifecycle/latest-phase-lifecycle.md'))).toBe(true);
  });
});
