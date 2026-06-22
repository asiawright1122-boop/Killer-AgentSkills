import { describe, expect, it } from 'vitest';
import { getSafeSandboxSkillRef, normalizeSandboxSkillRefSegment } from './sandbox-skill-ref';

describe('sandbox skill ref safety', () => {
  it('preserves normal GitHub owner and repo segments', () => {
    expect(getSafeSandboxSkillRef('anthropics', 'skills')).toBe('anthropics/skills');
    expect(getSafeSandboxSkillRef('user-name', 'repo.name_tools')).toBe('user-name/repo.name_tools');
  });

  it('removes shell metacharacters and hidden reasoning markers from sandbox refs', () => {
    const ref = getSafeSandboxSkillRef('owner; cat $HOME/.env', '<thinking>private</thinking>repo && whoami');

    expect(ref).not.toMatch(/[;&|`$<>(){}[\]"'\s]/);
    expect(ref).not.toMatch(/thinking|private|whoami|HOME/);
  });

  it('falls back to a safe segment when nothing public remains', () => {
    expect(normalizeSandboxSkillRefSegment('"; $()')).toBe('unknown');
  });
});
