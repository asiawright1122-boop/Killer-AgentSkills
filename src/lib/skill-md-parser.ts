export interface SkillMdFrontmatter {
  name?: string;
  description?: string;
  version?: string;
  author?: string;
  tags?: string[];
  body: string;
}

export function parseSkillMd(content: string): SkillMdFrontmatter {
  const normalizedContent = content.replace(/\r\n/g, '\n').trim();
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = normalizedContent.match(frontmatterRegex);

  if (!match) {
    return { body: normalizedContent };
  }

  const [, frontmatter, body] = match;
  const result: Record<string, unknown> = { body };

  const lines = frontmatter.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1);
        result[key] = value.split(',').map((s) => s.trim().replace(/['"]/g, ''));
      } else {
        result[key] = value.replace(/['"]/g, '');
      }
    }
  }

  return {
    name: result.name as string | undefined,
    description: result.description as string | undefined,
    version: result.version as string | undefined,
    author: result.author as string | undefined,
    tags: result.tags as string[] | undefined,
    body: result.body as string,
  };
}
