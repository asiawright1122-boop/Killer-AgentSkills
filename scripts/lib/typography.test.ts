import { describe, expect, it } from 'vitest';
import {
  cleanTypography,
  ensureTerminalPunctuation,
  formatSpacing,
  postProcessPhrasing,
} from './typography';

describe('Typography Engine', () => {
  describe('formatSpacing (CJK-English Spacing)', () => {
    it('inserts space between CJK and English/numbers', () => {
      expect(formatSpacing('使用AI技能进行Cursor配置')).toBe('使用 AI 技能进行 Cursor 配置');
      expect(formatSpacing('超过85%相似度')).toBe('超过 85% 相似度');
      expect(formatSpacing('Cursor和VS Code')).toBe('Cursor 和 VS Code');
    });

    it('inserts space around backticks', () => {
      expect(formatSpacing('在`Cursor`里安装')).toBe('在 `Cursor` 里安装');
      expect(formatSpacing('运行`npm run build`命令')).toBe('运行 `npm run build` 命令');
    });

    it('does not insert double spaces', () => {
      expect(formatSpacing('使用 AI 技能')).toBe('使用 AI 技能');
    });
  });

  describe('cleanTypography (Punctuation Conversion & Spacing Protection)', () => {
    it('converts western punctuation in Chinese (zh)', () => {
      expect(cleanTypography('安装已完成.', 'zh')).toBe('安装已完成。');
      expect(cleanTypography('这是技能,工具和扩展!', 'zh')).toBe('这是技能，工具和扩展！');
      expect(cleanTypography('确定吗?', 'zh')).toBe('确定吗？');
      expect(cleanTypography('注意:请遵守规则;', 'zh')).toBe('注意：请遵守规则；');
    });

    it('converts western punctuation in Japanese (ja)', () => {
      expect(cleanTypography('インストール完了.', 'ja')).toBe('インストール完了。');
      expect(cleanTypography('これはスキル,ツールと拡張!', 'ja')).toBe('これはスキル、ツールと拡張！');
      expect(cleanTypography('本当ですか?', 'ja')).toBe('本当ですか？');
    });

    it('keeps western periods and commas in Korean (ko) but converts marks', () => {
      expect(cleanTypography('설치가 완료되었습니다.', 'ko')).toBe('설치가 완료되었습니다.');
      expect(cleanTypography('이것은 스킬, 도구입니다!', 'ko')).toBe('이것은 스킬, 도구입니다！');
    });

    it('protects decimals, domains, and files from punctuation changes', () => {
      // decimals
      expect(cleanTypography('当前版本是3.5.0.', 'zh')).toBe('当前版本是 3.5.0。');
      // domain names
      expect(cleanTypography('访问fal.ai获取更多信息.', 'zh')).toBe('访问 fal.ai 获取更多信息。');
      // file path / extension
      expect(cleanTypography('编辑package.json文件.', 'zh')).toBe('编辑 package.json 文件。');
    });

    it('protects URL and curly braces', () => {
      expect(cleanTypography('访问 https://example.com/api 获取.', 'zh')).toBe('访问 https://example.com/api 获取。');
      expect(cleanTypography('您有{count}个未处理项.', 'zh')).toBe('您有 {count} 个未处理项。');
    });

    it('protects markdown links', () => {
      expect(cleanTypography('查看[文档](https://fal.ai/docs)说明.', 'zh')).toBe('查看 [文档](https://fal.ai/docs) 说明。');
    });

    it('does not touch non-CJK locales', () => {
      expect(cleanTypography('Hello, world. Is this ok?', 'en')).toBe('Hello, world. Is this ok?');
    });
  });

  describe('postProcessPhrasing (Technical Glossary)', () => {
    it('replaces raw terms in Chinese', () => {
      expect(postProcessPhrasing('测试AI Agent Skill和IDE integration', 'zh')).toBe('测试AI 智能体技能和IDE 集成');
    });

    it('replaces raw terms in Japanese', () => {
      expect(postProcessPhrasing('テストAIエージェントスキルとIDE統合', 'ja')).toBe('テストAIエージェントスキルとIDE統合');
      expect(postProcessPhrasing('AI Agent Skillのテスト', 'ja')).toBe('AIエージェントスキルのテスト');
    });
  });

  describe('ensureTerminalPunctuation', () => {
    it('appends correct CJK full-width period if missing', () => {
      expect(ensureTerminalPunctuation('安装已完成', 'zh')).toBe('安装已完成。');
      expect(ensureTerminalPunctuation('インストール完了', 'ja')).toBe('インストール完了。');
    });

    it('appends correct western period for non-zh/ja', () => {
      expect(ensureTerminalPunctuation('Setup complete', 'en')).toBe('Setup complete.');
      expect(ensureTerminalPunctuation('설치 완료', 'ko')).toBe('설치 완료.');
    });

    it('does not append if terminal punctuation exists', () => {
      expect(ensureTerminalPunctuation('已完成！', 'zh')).toBe('已完成！');
      expect(ensureTerminalPunctuation('Setup complete.', 'en')).toBe('Setup complete.');
    });
  });
});
