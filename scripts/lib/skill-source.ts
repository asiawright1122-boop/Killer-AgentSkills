import { posix as pathPosix } from 'node:path';

export function resolveSkillScoringPath(filePath?: string | null, repoPath?: string | null): string {
  const normalizedFilePath = String(filePath || '')
    .trim()
    .replace(/\\/g, '/');
  if (normalizedFilePath) return normalizedFilePath;

  return String(repoPath || '').trim();
}

export function deriveSkillStubTargetPath(filePath: string, content: string): string | null {
  const normalizedFilePath = String(filePath || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  if (!normalizedFilePath) return null;
  if (!/__SKILL__\.md/i.test(content)) return null;

  const explicitMatch = content.match(/`([^`\n\r]*__SKILL__\.md)`/i);
  const explicitTarget = explicitMatch?.[1]?.trim().replace(/\\/g, '/');
  const fallbackTarget = pathPosix.join(pathPosix.dirname(normalizedFilePath), '__SKILL__.md');

  let target = explicitTarget || fallbackTarget;
  if (!target) return null;

  if (!target.includes('/')) {
    target = pathPosix.join(pathPosix.dirname(normalizedFilePath), target);
  }

  const normalizedTarget = pathPosix.normalize(target).replace(/^\.\/+/, '').replace(/^\/+/, '');
  if (!normalizedTarget || normalizedTarget === normalizedFilePath) return null;

  return normalizedTarget;
}
