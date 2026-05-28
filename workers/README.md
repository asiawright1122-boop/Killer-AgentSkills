# Cloudflare Workflows

本目录包含 Killer-Skills 项目的 Cloudflare Workflows 定义。

## 工作流列表

### 1. Translation Workflow (`translation-workflow.ts`)

后台执行 AI 翻译任务。

**功能：**

- NVIDIA 多 key 健康度排序
- `guarded` fallback 到 SiliconFlow / OpenRouter
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

- `WORKFLOW_TRIGGER_SECRET`: 触发 `/workflows/*` 的 Bearer Token，未配置时接口会 fail closed
- `WEBHOOK_SECRET`: GitHub webhook 的 HMAC secret，未配置时 webhook 会 fail closed
- `GITHUB_TOKEN`: webhook 转发 repository_dispatch 时使用
- `NVIDIA_API_KEY` / `NVIDIA_API_KEYS`: NVIDIA NIM API 密钥
- `SILICONFLOW_API_KEY`: SiliconFlow 备用密钥
- `OPENROUTER_API_KEY` / `OPENROUTER_API_KEYS`: OpenRouter 备用密钥
- `AI_FALLBACK_POLICY`: 建议使用 `guarded`，仅在 NVIDIA 不可用时放开备援
- `AI_FALLBACK_ALWAYS_REASON`: 可选，记录 `always` 模式的触发原因

```bash
wrangler secret put NVIDIA_API_KEY
```
