/**
 * review-submission.ts
 *
 * Invoked by GitHub Action `.github/workflows/review-submission.yml`
 * whenever the edge API `submit.ts` intercepts a user submission.
 */

import fs from 'fs/promises';
import path from 'path';

const SAFE_GITHUB_SEGMENT = /^[A-Za-z0-9_.-]+$/;

function requireSafeGitHubSegment(value: string | undefined, label: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed || !SAFE_GITHUB_SEGMENT.test(trimmed)) {
    throw new Error(`Invalid ${label} payload.`);
  }
  return trimmed;
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+\-.!|>]/g, '\\$&');
}

async function main() {
  const owner = requireSafeGitHubSegment(process.env.SUBMISSION_OWNER, 'SUBMISSION_OWNER');
  const repo = requireSafeGitHubSegment(process.env.SUBMISSION_REPO, 'SUBMISSION_REPO');

  console.log(`===============================================`);
  console.log(`[Submission Review] Queueing manual review for ${owner}/${repo}`);
  console.log(`===============================================`);

  const evalPath = path.join(process.cwd(), 'data', 'submissions', `${owner}-${repo}.md`);
  await fs.mkdir(path.dirname(evalPath), { recursive: true });
  await fs.writeFile(
    evalPath,
    [
      `# Community Submission Review: ${escapeMarkdown(owner)}/${escapeMarkdown(repo)}`,
      '',
      'Status: manual-review-required',
      '',
      'This file is an intake record, not an approval. The submission API already verified that the repository exists and exposes a `SKILL.md`; a human maintainer still needs to review safety, license, quality, and SEO fit before merge.',
      '',
      '## Required Checks',
      '',
      '- [ ] Confirm repository ownership and license compatibility.',
      '- [ ] Inspect `SKILL.md` for prompt-injection, credential access, network exfiltration, and unsafe file-system instructions.',
      '- [ ] Verify user-facing title, description, tags, and install path are accurate.',
      '- [ ] Confirm generated metadata does not expose private reasoning, internal operator notes, or placeholder copy.',
      '',
      '## Source',
      '',
      `- Repository: https://github.com/${owner}/${repo}`,
      `- Submitted owner: \`${owner}\``,
      `- Submitted repo: \`${repo}\``,
      '',
    ].join('\n'),
  );

  console.log(`[Submission Review] Wrote manual-review intake record: ${evalPath}`);
}

main().catch((err) => {
  console.error('Critical Failure:', err);
  process.exit(1);
});
