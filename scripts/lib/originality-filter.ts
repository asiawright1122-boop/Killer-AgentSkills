import * as fs from 'fs';

/**
 * Robust multilingual tokenizer. Matches English words, numbers, and individual CJK characters.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/[\u4e00-\u9fa5]|[a-zA-Z0-9_]+/g);
  return matches ? matches.map((m) => m.toLowerCase()) : [];
}

/**
 * Calculates smooth IDF for a corpus of documents.
 * IDF(t) = log((1 + N) / (1 + df(t))) + 1
 */
export function calculateIdf(documents: string[][]): Map<string, number> {
  const N = documents.length;
  const idfMap = new Map<string, number>();
  const dfMap = new Map<string, number>();

  for (const doc of documents) {
    const uniqueTokens = new Set(doc);
    for (const token of uniqueTokens) {
      dfMap.set(token, (dfMap.get(token) || 0) + 1);
    }
  }

  for (const [token, df] of dfMap.entries()) {
    idfMap.set(token, Math.log((1 + N) / (1 + df)) + 1);
  }

  return idfMap;
}

/**
 * Computes TF-IDF vector for a set of tokens.
 */
export function getTfIdfVector(tokens: string[], idfMap: Map<string, number>): Map<string, number> {
  const tfMap = new Map<string, number>();
  for (const token of tokens) {
    tfMap.set(token, (tfMap.get(token) || 0) + 1);
  }

  const tfIdf = new Map<string, number>();
  const totalTokens = tokens.length || 1;

  for (const [token, count] of tfMap.entries()) {
    const tf = count / totalTokens;
    const idf = idfMap.get(token) ?? 1; // Default fallback to 1 for out-of-corpus tokens
    tfIdf.set(token, tf * idf);
  }

  return tfIdf;
}

/**
 * Calculates cosine similarity between two TF-IDF vectors.
 */
export function calculateCosineSimilarity(vectorA: Map<string, number>, vectorB: Map<string, number>): number {
  let dotProduct = 0;
  for (const [token, valA] of vectorA.entries()) {
    const valB = vectorB.get(token) || 0;
    dotProduct += valA * valB;
  }

  let magnitudeA = 0;
  for (const valA of vectorA.values()) {
    magnitudeA += valA * valA;
  }
  magnitudeA = Math.sqrt(magnitudeA);

  let magnitudeB = 0;
  for (const valB of vectorB.values()) {
    magnitudeB += valB * valB;
  }
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Validates the metadata and originality of the harvested skill.
 * Rejects thin content (body < 200 words) and missing metadata (owner, repo, tags).
 */
export function validateOriginalityAndMetadata(
  metadata: { owner?: string; repo?: string; tags?: string[] },
  body: string
): { valid: boolean; reason?: string } {
  if (!metadata.owner || metadata.owner.trim() === '') {
    return { valid: false, reason: 'Missing owner metadata' };
  }
  if (!metadata.repo || metadata.repo.trim() === '') {
    return { valid: false, reason: 'Missing repo metadata' };
  }
  if (!metadata.tags || !Array.isArray(metadata.tags) || metadata.tags.length === 0) {
    return { valid: false, reason: 'Missing tags' };
  }

  const tokens = tokenize(body || '');
  if (tokens.length < 200) {
    return {
      valid: false,
      reason: `Thin content: body content too short (${tokens.length} words, minimum 200 required)`,
    };
  }

  return { valid: true };
}

/**
 * Injects a structured originality block to provide canonical backlinks and prevent SEO mirror penalties.
 */
export function injectOriginalityBlock(
  body: string,
  metadata: { owner: string; repo: string; filePath: string }
): string {
  if (body.includes('<!-- originality-block-start -->') || body.includes('## 🏷️ Originality & Credits')) {
    return body;
  }

  const cleanFilePath = metadata.filePath.startsWith('/') ? metadata.filePath.slice(1) : metadata.filePath;
  const fileName = cleanFilePath.split('/').pop() || 'SKILL.md';

  const originalityBlock = `

<!-- originality-block-start -->
---

## 🏷️ Originality & Credits

This skill is harvested from the open-source repository:
- **Original Repository**: [${metadata.owner}/${metadata.repo}](https://github.com/${metadata.owner}/${metadata.repo})
- **Source File**: [${fileName}](https://github.com/${metadata.owner}/${metadata.repo}/blob/main/${cleanFilePath})

> [!NOTE]
> *First-party Analysis & Compatibility Statement*: This copy has been validated and cached by the Killer-Skills gateway. Dynamic execution compatibility is monitored against active model runtimes.
<!-- originality-block-end -->`;

  return body.trim() + originalityBlock;
}
