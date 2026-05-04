export const polishCollectionPublicText = (value: string | undefined, locale: string) => {
  let text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';

  if (locale.startsWith('zh')) {
    text = text
      .replace(/比较\s+/g, '比较')
      .replace(/查看安装路径、实际用途与团队适配/g, '查看安装路径、实际用途和适合的开发环境')
      .replace(
        /查看安装路径、适用场景，以及适合 Claude Code、Cursor 与 Windsurf 的工具/g,
        '查看安装路径、适用场景，以及适合 Claude Code、Cursor 与 Windsurf 的实用工具',
      );
  }

  return text;
};
