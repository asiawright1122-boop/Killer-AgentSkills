---
phase: 130
plan: 130-01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/gsc-url-inspection-verify.ts
autonomous: true
must_haves:
  artifacts:
    - path: scripts/gsc-url-inspection-verify.ts
      min_lines: 300
  key_links: []
---

# Phase 130 Plan — Workspace & Auto-Submitter Size Optimization

## Objective

Optimize the local workspace and repository size by clean-up of redundant Puppeteer page screenshots, legacy submission logs, staging build artifacts, temporary cache files, and older GSC (Google Search Console) coverage archive directories. Before removing the older GSC archives, reconstruct the dependent verification script to dynamically resolve the latest archive path rather than using a hardcoded one. Finally, run a complete verification loop (158 tests, typecheck, Astro build) to guarantee zero regressions.

## Requirement Traceability

- **CLEAN-01**: Clean up redundant large logs, browser screenshot artifacts, and browser state directories from `scripts/auto-submitter`.
- **CLEAN-02**: Audit and purge deprecated or temporary build artifacts, staging buffers, and draft cached files from `data/` and root `.tmp` directories.

***

## Tasks

### Task 1: Reconstruct scripts/gsc-url-inspection-verify.ts

<read_first>
- Modify: `scripts/gsc-url-inspection-verify.ts`
- Reference: `scripts/lib/coverage-drilldown-source.ts`
</read_first>

<acceptance_criteria>
- `scripts/gsc-url-inspection-verify.ts` contains the import statement for `discoverCoverageDrilldownSourceDirectories` from `./lib/coverage-drilldown-source`.
- `scripts/gsc-url-inspection-verify.ts` does not contain the hardcoded string `killer-skills.com-Coverage-Drilldown-2026-04-16`.
- `npx tsx scripts/gsc-url-inspection-verify.ts` compiles and successfully resolves the latest available Coverage Drilldown source directory (`2026-06-03`).
</acceptance_criteria>

<action>
1. Open `scripts/gsc-url-inspection-verify.ts`.
2. Add the import statement for `discoverCoverageDrilldownSourceDirectories` near the top of the file:
   ```typescript
   import { discoverCoverageDrilldownSourceDirectories } from './lib/coverage-drilldown-source';
   ```
3. Locate the `main` function (around line 236), specifically the line declaring `archiveDir`:
   ```typescript
   const archiveDir = resolve(process.cwd(), 'data/coverage-drilldown-raw/killer-skills.com-Coverage-Drilldown-2026-04-16');
   ```
4. Replace this declaration with dynamic directory discovery logic:
   ```typescript
   const sources = discoverCoverageDrilldownSourceDirectories();
   if (sources.length === 0) {
     console.error('No coverage drilldown directories found');
     process.exit(1);
   }
   const archiveDir = sources[0].directoryPath; // Sorts descending by date; index 0 is the newest directory
   ```
5. Save the file and run `npx tsx scripts/gsc-url-inspection-verify.ts` or run a quick typecheck to ensure it compiles correctly without syntax or type errors.
</action>

***

### Task 2: Delete Redundant Log Files and Directories

<read_first>
- Delete targets:
  - `scripts/auto-submitter/logs/screenshots/`
  - `scripts/auto-submitter/logs/*.log`
  - `scripts/auto-submitter/logs/*.json`
  - `logs/*.log`
  - `.tmp/scripts_errors*.txt`
  - `.tmp/workers-ai-usage.json`
  - `data/coverage-drilldown-raw/killer-skills.com-Coverage-Drilldown-2026-04-03/`
  - `data/coverage-drilldown-raw/killer-skills.com-Coverage-Drilldown-2026-04-16/`
  - `data/drafts/`
  - Project root git-ignored files:
    - `all_enabled_t1.txt`
    - `clean_candidates.txt`
    - `discovered_domains.txt`
    - `enabled_t1.txt`
    - `get_github_lists.sh`
    - `get_remaining.js`
    - `get_remaining.ts`
    - `known_domains.txt`
    - `new_candidates.txt`
    - `probe_list.txt`
    - `probe_list_final.txt`
    - `probe_test.txt`
    - `raw_discovery.md`
    - `submitted_basenames.txt`
    - `submitted_hosts.txt`
    - `valid_new_sites.json`
    - `ph_step2_error.png`
    - `ph_step2_filled.png`
    - `ph_step3_images_uploaded.png`
    - `findings.md`
    - `progress.md`
    - `task_plan.md`
</read_first>

<acceptance_criteria>
- None of the target files or directories listed in `<read_first>` exist in the workspace.
- The `data/coverage-drilldown-raw/` directory contains only the `killer-skills.com-Coverage-Drilldown-2026-06-03` directory.
- `git status` reports only the modification to `scripts/gsc-url-inspection-verify.ts` and no untracked files remain from the deletion list.
</acceptance_criteria>

<action>
Execute the following commands in the workspace root to purge the redundant files and directories:
```bash
rm -rf scripts/auto-submitter/logs/screenshots/
rm -f scripts/auto-submitter/logs/*.log
rm -f scripts/auto-submitter/logs/*.json
rm -f logs/pipeline-*.log
rm -f logs/discovery.log
rm -f .tmp/scripts_errors*.txt
rm -f .tmp/workers-ai-usage.json
rm -rf data/coverage-drilldown-raw/killer-skills.com-Coverage-Drilldown-2026-04-03/
rm -rf data/coverage-drilldown-raw/killer-skills.com-Coverage-Drilldown-2026-04-16/
rm -rf data/drafts/
rm -f all_enabled_t1.txt clean_candidates.txt discovered_domains.txt enabled_t1.txt get_github_lists.sh get_remaining.js get_remaining.ts known_domains.txt new_candidates.txt probe_list.txt probe_list_final.txt probe_test.txt raw_discovery.md submitted_basenames.txt submitted_hosts.txt valid_new_sites.json
rm -f ph_step2_error.png ph_step2_filled.png ph_step3_images_uploaded.png
rm -f findings.md progress.md task_plan.md
```
Run `git status` to verify that there are no remaining untracked target files.
</action>

***

### Task 3: Run Full Verification Loop

<read_first>
- Target: Entire workspace
- Verification commands: `npm run typecheck`, `npm test`, `npm run build`
</read_first>

<acceptance_criteria>
- `npm run typecheck` exits with code 0.
- `npm test` runs and all 158 integration/unit tests pass cleanly.
- `npm run build` compiles the Astro production bundle successfully.
</acceptance_criteria>

<action>
Execute the following verification sequence in order:
1. Compile and typecheck:
   ```bash
   npm run typecheck
   ```
2. Run test suites:
   ```bash
   npm test
   ```
3. Run build to verify Astro outputs are functional:
   ```bash
   npm run build
   ```
Ensure all commands exit successfully.
</action>

***

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Dependency script `gsc-url-inspection-verify.ts` fails to find newest directory | The script performs a fallback check `sources.length === 0` and exits gracefully with an error message instead of crashing with an unhandled exception |
| Crucial data files like `authority-surfaces.json` are accidentally deleted | Strict path specifications are used in Task 2. Do not use open wildcards like `rm -rf data/*`. Only target specific folders/files (`data/drafts/`, old coverage drilldown folders) |
| Local tests break due to lack of historical GSC files | The latest archive `2026-06-03` is preserved and the dynamic helper library handles the date resolution correctly. Verification test suites are run at Task 3 to confirm stability |
