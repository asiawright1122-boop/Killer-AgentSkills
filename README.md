# Killer-Skills

The ultimate directory of AI Development Skills for Agents (MCP, LangChain, etc.).

AI Agent 开发技能终极目录（支持 MCP, LangChain 等）。

🌍 **[Website / 官网](https://killer-skills.com)**

---

## 🇺🇸 English

### 🚀 Stack & Features

- **Universal IDE Support**: Write once, run everywhere (Cursor, Windsurf, VS Code, Copilot)
- **Framework**: [Astro 5.0](https://astro.build) (Server-side Rendering)
- **Deployment**: [Cloudflare Pages](https://pages.cloudflare.com) (Advanced Mode)
- **Styling**: TailwindCSS 4.0
- **Database**: Cloudflare KV (`SKILLS_CACHE`, `TRANSLATIONS`)
- **i18n**: Native Astro i18n + Cloudflare AI Translation

### 🛠️ Development

#### Prerequisites

- Node.js 20+
- `npm` or `pnpm`
- Cloudflare Wrangler CLI

#### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Deploy to Cloudflare Pages:
   ```bash
   npm run deploy
   ```

### 📂 Project Structure

- `src/pages`: File-based routing (Astro)
- `src/components`: Astro & React components
- `src/lib`: Core logic (KV, GitHub API, AI)
- `packages/cli`: Killer-Skills CLI tool
- `packages/og-server`: Open Graph Image Generator

### 🌍 Internationalization

Supported locales: `en`, `zh`, `ja`, `ko`, `es`, `fr`, `de`, `pt`, `ru`, `ar`.
Translations are stored in `src/messages/*.json` and managed via Cloudflare KV.

---

## 🇨🇳 中文

### 🚀 技术栈与特性

- **通用 IDE 支持**: 一次编写，处处运行 (Cursor, Windsurf, VS Code, Copilot)
- **框架**: [Astro 5.0](https://astro.build) (服务端渲染 SSR)
- **部署**: [Cloudflare Pages](https://pages.cloudflare.com) (Advanced Mode)
- **样式**: TailwindCSS 4.0
- **数据库**: Cloudflare KV (`SKILLS_CACHE`, `TRANSLATIONS`)
- **国际化 (i18n)**: 原生 Astro i18n + Cloudflare AI 自动翻译

### 🛠️ 开发指南

#### 前置要求

- Node.js 20+
- `npm` 或 `pnpm`
- Cloudflare Wrangler CLI

#### 设置步骤

1. 安装依赖:
   ```bash
   npm install
   ```

2. 启动开发服务器:
   ```bash
   npm run dev
   ```

3. 部署到 Cloudflare Pages:
   ```bash
   npm run deploy
   ```

### 📂 项目结构

- `src/pages`: 文件路由 (Astro)
- `src/components`: Astro & React 组件
- `src/lib`: 核心逻辑 (KV, GitHub API, AI)
- `packages/cli`: Killer-Skills CLI 工具
- `packages/og-server`: Open Graph 图片生成器

### 🌍 国际化

支持语言: `en`, `zh`, `ja`, `ko`, `es`, `fr`, `de`, `pt`, `ru`, `ar`.
翻译文件存储在 `src/messages/*.json`，并通过 Cloudflare KV 管理。

---

## 📄 License

MIT © Killer-Skills Inc.
