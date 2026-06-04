import { describe, expect, it } from 'vitest';
import {
  countExtraSkillSegments,
  hasFileLikeLastSegment,
  hasRepeatedSegment,
  isFileLikeSkillRouteTail,
  isSkillRoutePathname,
  isSourceFilePathname,
} from './coverage-url-classification';

const FILE_EXT_REGEX = /\.(md|mdx|ts|tsx|js|jsx|py|json|go|yaml|yml|toml|rs|rb|css|xml|txt|ini|csv|lock)$/i;

describe('coverage url classification helpers', () => {
  it('does not treat dotted repo names as source files', () => {
    expect(isSourceFilePathname('/en/skills/vercel/next.js', FILE_EXT_REGEX)).toBe(false);
    expect(isSourceFilePathname('/en/skills/vercel/next.js/flags', FILE_EXT_REGEX)).toBe(false);
  });

  it('still treats nested file tails as source files', () => {
    expect(isSourceFilePathname('/en/skills/vercel/next.js/README.md', FILE_EXT_REGEX)).toBe(true);
    expect(isSourceFilePathname('/ar/skills/antvis/GPT-Vis/references/waterfall.md', FILE_EXT_REGEX)).toBe(true);
  });

  it('only flags the tail of skill route segments as file-like', () => {
    expect(isFileLikeSkillRouteTail(['next.js'], FILE_EXT_REGEX)).toBe(false);
    expect(isFileLikeSkillRouteTail(['next.js', 'flags'], FILE_EXT_REGEX)).toBe(false);
    expect(isFileLikeSkillRouteTail(['next.js', 'README.md'], FILE_EXT_REGEX)).toBe(true);
  });

  it('keeps non-skill generic file tails detectable', () => {
    expect(hasFileLikeLastSegment('/docs/manifest.json', FILE_EXT_REGEX)).toBe(true);
  });

  it('counts extra skill segments only after owner/repo', () => {
    expect(countExtraSkillSegments('/en/skills/vercel/next.js')).toBe(0);
    expect(countExtraSkillSegments('/en/skills/vercel/next.js/flags')).toBe(0);
    expect(countExtraSkillSegments('/en/skills/vercel/next.js/flags/README.md')).toBe(1);
  });

  it('detects repeated path segments independently from dotted repo names', () => {
    expect(hasRepeatedSegment('/en/skills/foo/bar/references/references/file.md')).toBe(true);
    expect(hasRepeatedSegment('/en/skills/vercel/next.js/flags')).toBe(false);
  });

  it('recognizes standard skill route pathnames', () => {
    expect(isSkillRoutePathname('/en/skills/vercel/next.js')).toBe(true);
    expect(isSkillRoutePathname('/ja/skills/sabaronnie/AI-Driven-Cronut-CEO-Agent')).toBe(true);
    expect(isSkillRoutePathname('/ko/skills/OpenGradient/OpenGradient-SDK')).toBe(true);
    expect(isSkillRoutePathname('/en/skills/vercel/next.js/flags')).toBe(true);
  });

  it('rejects non-skill paths for isSkillRoutePathname', () => {
    expect(isSkillRoutePathname('/en/skills')).toBe(false);
    expect(isSkillRoutePathname('/en/skills/vercel')).toBe(false);
    expect(isSkillRoutePathname('/blog/hello')).toBe(false);
    expect(isSkillRoutePathname('/docs/manifest.json')).toBe(false);
  });
});
