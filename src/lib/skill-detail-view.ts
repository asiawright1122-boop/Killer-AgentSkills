type SkillSourceKind = 'official' | 'community';

export { buildMarketplaceDetailTrust } from './marketplace-policy';

const normalizeLabel = (value: unknown) => String(value ?? '').trim();

function uniqueNonEmpty(values: string[], limit = 6): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const label = normalizeLabel(value);
    if (!label) continue;

    const key = label.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(label);
    if (result.length >= limit) break;
  }

  return result;
}

export function pickDetailTaskChips(input: {
  useCases: string[];
  topics: string[];
  features: string[];
  limit?: number;
}): string[] {
  return uniqueNonEmpty(
    [...(input.useCases || []), ...(input.features || []), ...(input.topics || [])],
    input.limit ?? 6,
  );
}

export function getDetailSourceKind(input: {
  isVerified: boolean;
  sourceKind?: 'official' | 'community' | string;
}): SkillSourceKind {
  return input.sourceKind === 'official' || input.sourceKind === 'community'
    ? input.sourceKind
    : input.isVerified
      ? 'official'
      : 'community';
}

export function buildDetailRiskChips(input: {
  visibleRiskLabels: string[];
  riskFlags: Array<{ code?: string; label?: string }>;
}): string[] {
  const fallbackLabels = (input.riskFlags || []).map((flag) => flag.label || flag.code || '');
  return uniqueNonEmpty([...(input.visibleRiskLabels || []), ...fallbackLabels], 5);
}
