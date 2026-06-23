import { describe, it, expect } from 'vitest';
import {
  tokenize,
  calculateIdf,
  getTfIdfVector,
  calculateCosineSimilarity,
  validateOriginalityAndMetadata,
  injectOriginalityBlock,
} from './originality-filter';

describe('Originality Filter Engine', () => {
  describe('tokenize', () => {
    it('should split English words and CJK characters correctly', () => {
      const text = 'Hello, 世界! This is a test 123.';
      const tokens = tokenize(text);
      expect(tokens).toEqual([
        'hello',
        '世',
        '界',
        'this',
        'is',
        'a',
        'test',
        '123',
      ]);
    });

    it('should return empty array for empty text', () => {
      expect(tokenize('')).toEqual([]);
      expect(tokenize(null as any)).toEqual([]);
    });
  });

  describe('TF-IDF & Cosine Similarity', () => {
    it('should compute high similarity for overlapping texts and low for distinct ones', () => {
      const doc1 = tokenize('The quick brown fox jumps over the lazy dog');
      const doc2 = tokenize('The fast brown fox leaps over the lazy dog');
      const doc3 = tokenize('Python is a programming language with dynamic typing');

      const corpus = [doc1, doc2, doc3];
      const idfMap = calculateIdf(corpus);

      const vec1 = getTfIdfVector(doc1, idfMap);
      const vec2 = getTfIdfVector(doc2, idfMap);
      const vec3 = getTfIdfVector(doc3, idfMap);

      const sim12 = calculateCosineSimilarity(vec1, vec2);
      const sim13 = calculateCosineSimilarity(vec1, vec3);

      expect(sim12).toBeGreaterThan(0.6); // Fox documents should have high similarity
      expect(sim13).toBeLessThan(0.1);    // Fox and Python should be very low
    });

    it('should handle identical texts with similarity close to 1', () => {
      const doc = tokenize('This is a completely identical test sentence.');
      const idfMap = calculateIdf([doc]);
      const vec = getTfIdfVector(doc, idfMap);
      const sim = calculateCosineSimilarity(vec, vec);
      expect(sim).toBeCloseTo(1.0, 5);
    });
  });

  describe('validateOriginalityAndMetadata', () => {
    const validMeta = { owner: 'test-owner', repo: 'test-repo', tags: ['ai-agent'] };
    const longBody = Array(220).fill('word').join(' ');

    it('should pass for valid inputs', () => {
      const result = validateOriginalityAndMetadata(validMeta, longBody);
      expect(result.valid).toBe(true);
    });

    it('should reject missing owner', () => {
      const result = validateOriginalityAndMetadata({ repo: 'test-repo', tags: ['ai'] }, longBody);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('owner');
    });

    it('should reject empty owner name', () => {
      const result = validateOriginalityAndMetadata({ owner: ' ', repo: 'test-repo', tags: ['ai'] }, longBody);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('owner');
    });

    it('should reject missing repo', () => {
      const result = validateOriginalityAndMetadata({ owner: 'test-owner', tags: ['ai'] }, longBody);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('repo');
    });

    it('should reject empty tags', () => {
      const result = validateOriginalityAndMetadata({ owner: 'test-owner', repo: 'test-repo', tags: [] }, longBody);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('tags');
    });

    it('should reject thin content', () => {
      const shortBody = 'Too short description of a skill.';
      const result = validateOriginalityAndMetadata(validMeta, shortBody);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Thin content');
    });
  });

  describe('injectOriginalityBlock', () => {
    const meta = { owner: 'awesome-owner', repo: 'cool-repo', filePath: 'skills/my-skill/SKILL.md' };
    const body = '# My Cool Skill\nSome nice description details here.';

    it('should append originality block to the body', () => {
      const result = injectOriginalityBlock(body, meta);
      expect(result).toContain('## 🏷️ Originality & Credits');
      expect(result).toContain('https://github.com/awesome-owner/cool-repo');
      expect(result).toContain('https://github.com/awesome-owner/cool-repo/blob/main/skills/my-skill/SKILL.md');
      expect(result).toContain('First-party Analysis & Compatibility Statement');
    });

    it('should not duplicate block if already present', () => {
      const firstInjected = injectOriginalityBlock(body, meta);
      const secondInjected = injectOriginalityBlock(firstInjected, meta);
      expect(secondInjected).toEqual(firstInjected);
    });
  });
});
