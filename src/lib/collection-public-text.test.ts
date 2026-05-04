import { describe, expect, it } from 'vitest';
import { polishCollectionPublicText } from './collection-public-text';

describe('collection-public-text', () => {
  it('removes mechanical Chinese collection metadata phrasing before rendering', () => {
    expect(
      polishCollectionPublicText(
        '比较 优先安装的 Agent 工作流构建工具，查看安装路径、适用场景，以及适合 Claude Code、Cursor 与 Windsurf 的工具。',
        'zh',
      ),
    ).toBe(
      '比较优先安装的 Agent 工作流构建工具，查看安装路径、适用场景，以及适合 Claude Code、Cursor 与 Windsurf 的实用工具。',
    );
    expect(polishCollectionPublicText('优先安装的 CLI 工作流工具，查看安装路径、实际用途与团队适配。', 'zh')).toBe(
      '优先安装的 CLI 工作流工具，查看安装路径、实际用途和适合的开发环境。',
    );
  });
});
