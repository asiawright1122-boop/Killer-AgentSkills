# 项目命令与工作流指南

Killer-Skills 项目的所有可用脚本和命令的综合指南。

## 🚀 快速开始

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动本地 Astro 开发服务器 |
| `npm run build` | 构建生产环境代码 (Cloudflare Workers) |
| `npm run preview` | 本地预览生产构建结果 |
| `npm run deploy` | 部署到 Cloudflare Workers |

## 🧬 数据管道 (Data Pipeline)

本项目依赖数据管道来收集、处理并同步 AI 技能数据到 Cloudflare KV。

| 命令 | 脚本文件 | 说明 |
|------|----------|------|
| `npm run pipeline:run` | `scripts/run-pipeline.sh` | **主控命令**。一键执行“收割 -> 构建 -> 同步”全流程。支持 `--once` 单次运行或守护进程模式。 |
| `npm run skills:harvest` | `scripts/harvest-github-skills.ts` | 从 GitHub 抓取含 `SKILL.md` 的新仓库。<br>**参数:** `--target=500` (抓取 N 个新技能后停止) |
| `npm run build:cache` | `scripts/build-skills-cache.ts` | 将原始 GitHub 数据处理为 `data/skills-cache.json`。使用 AI 生成 SEO 元数据和分类。<br>**参数:** `--mode=discover` (增量构建) |
| `npm run sync:kv` | `scripts/sync-to-kv.ts` | 将 `skills-cache.json` 和 `docs-cache.json` 同步到 Cloudflare KV (生产数据库)。 |

## 🌍 翻译与本地化 (Translation & Localization)

支持 9 种语言的内容和 UI 自动化翻译：`zh, ja, ko, es, fr, de, pt, ru, ar`。

| 命令 | 脚本文件 | 说明 |
|------|----------|------|
| `npm run translate:blog` | `scripts/translate-blog.ts` | **[NEW]** 翻译新增的英文博客文章。采用 AI 竞速策略、增量构建，并智能保留 Markdown 格式。<br>**参数:** `--slug=slug` (指定单篇), `--dry-run` (预览) |
| `npx tsx scripts/translate-locales.ts` | `scripts/translate-locales.ts` | 扫描 `src/messages/en.json` 的新 Key 并自动翻译到其他语言文件。 |
| `npm run build:docs` | `scripts/build-docs-cache.ts` | 翻译 `docs/source` 下的文档并构建 `data/docs-cache.json`。 |
| `npx tsx scripts/sync-blog-everything.ts` | `scripts/sync-blog-everything.ts` | 将英文文章的元数据 (Hero Image, Layout) 和内链同步到所有已翻译的文章中。 |

## 🛠️ 维护与 SEO

| 命令 | 脚本文件 | 说明 |
|------|----------|------|
| `npm run submit:indexnow` | `scripts/submit-indexnow.mjs` | 将所有 Sitemap URL 通过 IndexNow 协议提交给 Bing/Yandex。 |
| `npm run clean:kv` | (Shell 命令) | 清除本地 Wrangler KV 状态 (用于重置开发环境)。 |
| `npx tsx scripts/verify-cjk.js` | `scripts/verify-cjk.js` | 检查生成的缓存中是否存在 CJK 翻译缺失或损坏的情况。 |
| `npx tsx scripts/scan-broken-skills.js` | `scripts/scan-broken-skills.js` | 扫描死链或格式错误的技能文件。 |

## 🤖 Agent Workflows

辅助 AI Agent 的工作流指令 (位于 `.agent/workflows/`)。

- **`/add-blog`**: 交互式工作流，引导您添加新博客文章、自动翻译、同步元数据并部署。
