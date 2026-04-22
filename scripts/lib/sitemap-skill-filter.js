const NON_TARGET_THEME_PATTERNS = [
  /\b(interview|mock\s*interview|interview\s*prep|interview\s*questions?)\b/i,
  /\bleetcode\b|(?:\bportfolio\b[\s\S]{0,24}\b(personal|resume|cv|site|showcase|template|builder|generator|writer)\b)|(?:\b(resume|cv|curriculum\s+vitae)\b[\s\S]{0,32}\b(job|career|hiring|application|screening|template|builder|generator|writer|latex)\b)/i,
  /\b(product\s*manager|product\s*managers|product\s*management|pm-os|prd-writer|jobs-to-be-done)\b/i,
  /\b(mvp\s*builder|mvp-builder|mvp\s*generator|minimum\s*viable\s+product|startup\s*pitch)\b/i,
];

export function getReadmeContent(skill) {
  return skill?.skillMd?.body || skill?.skillMd?.bodyPreview || '';
}

export function pickPreferredText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value !== 'object') return '';

  const preferred = [value.en, value.zh, ...Object.values(value)];
  for (const candidate of preferred) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return '';
}

export function isPublicSkillForSitemap(skill) {
  const combinedText = [
    skill?.name || '',
    skill?.owner || '',
    skill?.repo || '',
    pickPreferredText(skill?.description),
    ...(Array.isArray(skill?.topics) ? skill.topics : []),
    skill?.category || '',
    skill?.filePath || '',
    getReadmeContent(skill),
  ]
    .join(' ')
    .toLowerCase();

  return !NON_TARGET_THEME_PATTERNS.some((pattern) => pattern.test(combinedText));
}
