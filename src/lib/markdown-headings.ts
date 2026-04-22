export interface MarkdownTocItem {
  id: string;
  label: string;
  level: number;
}

const normalizeMarkdownHeading = (text: string): string =>
  text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~]/g, '')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const slugifyHeading = (text: string): string =>
  normalizeMarkdownHeading(text)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export const extractMarkdownHeadings = (markdown: string, levels: number[] = [2, 3]): MarkdownTocItem[] => {
  const counts = new Map<string, number>();
  const items: MarkdownTocItem[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;

    const level = match[1].length;
    if (!levels.includes(level)) continue;

    const label = normalizeMarkdownHeading(match[2]);
    const baseId = slugifyHeading(label);
    if (!label || !baseId) continue;

    const nextCount = (counts.get(baseId) || 0) + 1;
    counts.set(baseId, nextCount);

    items.push({
      id: nextCount === 1 ? baseId : `${baseId}-${nextCount}`,
      label,
      level,
    });
  }

  return items;
};
