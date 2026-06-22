import { describe, expect, it } from 'vitest';
import {
  createPublicAIOutputStreamSanitizer,
  findHiddenReasoningPublicOutputMatches,
  sanitizePublicAIOutput,
  sanitizePublicAIOutputValue,
} from './public-ai-output';

describe('sanitizePublicAIOutput', () => {
  it('removes hidden reasoning tags and labeled scratchpad sections', () => {
    const output = sanitizePublicAIOutput(`
<thinking>private notes</thinking>

Chain of thought:
step-by-step private analysis

## Final
Use the reviewed answer.

<reasoning>hidden explanation</reasoning>
`);

    expect(output).toBe('## Final\nUse the reviewed answer.');
    expect(output).not.toMatch(/thinking|chain of thought|private analysis|reasoning/i);
  });

  it('preserves normal public copy about reasoning capabilities', () => {
    const output = sanitizePublicAIOutput(
      'This tool supports multi-step reasoning for architecture reviews and provides a concise rationale.',
    );

    expect(output).toBe(
      'This tool supports multi-step reasoning for architecture reviews and provides a concise rationale.',
    );
  });

  it('removes stray and unclosed hidden reasoning tags', () => {
    const output = sanitizePublicAIOutput(`
Final answer </Reasoning>
Visible line
<analysis>private notes that should not leak
`);

    expect(output).toBe('Final answer \nVisible line');
    expect(output).not.toMatch(/<\/?reasoning>|<\/?analysis>|private notes/i);
  });

  it('finds public-output leak markers without matching normal reasoning copy', () => {
    expect(findHiddenReasoningPublicOutputMatches('<thinking>private</thinking>')).toEqual(['<thinking>']);
    expect(findHiddenReasoningPublicOutputMatches('Chain-of-thought:\nprivate notes')).toEqual(['Chain-of-thought:']);
    expect(
      findHiddenReasoningPublicOutputMatches('This tool supports multi-step reasoning for architecture reviews.'),
    ).toEqual([]);
    expect(
      findHiddenReasoningPublicOutputMatches(
        'Use chain-of-thought prompting, few-shot learning, or structured outputs when appropriate.',
      ),
    ).toEqual([]);
    expect(findHiddenReasoningPublicOutputMatches('Write temporary files to .scratchpad/usage-reports/.')).toEqual([]);
  });

  it('recursively sanitizes structured public AI output', () => {
    const output = sanitizePublicAIOutputValue({
      title: 'Useful summary',
      'Hidden reasoning:': 'private key label',
      seo: {
        description: '<thinking>private</thinking>Public meta description.',
        features: ['First feature', 'Scratchpad:\nprivate notes\n\nSecond feature'],
      },
    });

    expect(output).toEqual({
      title: 'Useful summary',
      '': 'private key label',
      seo: {
        description: 'Public meta description.',
        features: ['First feature', 'Second feature'],
      },
    });
  });

  it('preserves non-plain objects while sanitizing surrounding JSON records', () => {
    const timestamp = new Date('2026-06-08T00:00:00.000Z');
    const output = sanitizePublicAIOutputValue({
      timestamp,
      label: '<analysis>private</analysis>Public label',
    }) as { timestamp: Date; label: string };

    expect(output.timestamp).toBe(timestamp);
    expect(JSON.stringify(output)).toContain('2026-06-08T00:00:00.000Z');
    expect(output.label).toBe('Public label');
  });

  it('emits only public deltas when hidden reasoning spans stream chunks', () => {
    const stream = createPublicAIOutputStreamSanitizer();

    expect(stream.push('<thinking>private')).toBe('');
    expect(stream.push(' notes</thinking>Public')).toBe('Public');
    expect(stream.push(' answer')).toBe(' answer');
    expect(stream.push('\nScratchpad:\nprivate')).toBe('');
    expect(stream.push(' stream notes\n\nFinal')).toBe('\n\nFinal');
    expect(stream.getPublicOutput()).toBe('Public answer\n\nFinal');
    expect(findHiddenReasoningPublicOutputMatches(stream.getPublicOutput())).toEqual([]);
  });
});
