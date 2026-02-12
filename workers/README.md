# Cloudflare Workflows

本目录包含 Killer-Skills 项目的 Cloudflare Workflows 定义。

## 工作流列表

### 1. Translation Workflow (`translation-workflow.ts`)

后台执行 AI 翻译任务。

**功能：**
- 自动重试 (3 次，指数退避)
- 状态持久化 (崩溃后可恢复)
- 结果缓存到 KV

**触发方式：**
```bash
wrangler workflows trigger translation-workflow \
  --payload '{"text":"Hello world","targetLang":"zh","type":"text","cacheKey":"test:hello:zh"}'
```

### 2. Skill Validation Workflow (`skill-validation-workflow.ts`)

验证 GitHub 仓库的 SKILL.md 并更新缓存。

**功能：**
- 获取并解析 SKILL.md
- 获取仓库元信息 (stars, topics)
- 更新 KV 缓存
- 触发多语言翻译

**触发方式：**
```bash
wrangler workflows trigger skill-validation-workflow \
  --payload '{"owner":"anthropics","repo":"anthropic-cookbook"}'
```

## 部署

```bash
# 部署所有 Workers (包括主应用和 Workflows)
npm run cf:deploy

# 单独部署 Workflows
wrangler deploy workers/translation-workflow.ts --name translation-workflow
wrangler deploy workers/skill-validation-workflow.ts --name skill-validation-workflow
```

## 监控

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 Workers & Pages → Workflows
3. 查看执行历史、成功率、耗时

## 环境变量

需要在 Cloudflare Dashboard 或通过 `wrangler secret put` 配置：

- `NVIDIA_API_KEY`: NVIDIA NIM API 密钥 (用于翻译)

```bash
wrangler secret put NVIDIA_API_KEY
```
