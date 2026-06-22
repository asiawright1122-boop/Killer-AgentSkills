# Phase 115 Discussion Log

Generated on: 2026-06-09

## Discussed Areas & Q&A

### 1. Batching Scope
- **Question:** Which approach for Batching Scope?
- **Selection:** (Recommended) 限制丰富范围在 `data/authority-surfaces.json` 列出的 collection 页面中，不扩大到全量 38 个 JSON 集合。
- **Decision:** Target only collections defined in authority-surfaces.json that require enrichment.

### 2. LLM Provider & Model Selection
- **Question:** Which approach for LLM Provider & Model Selection?
- **Selection:** (Recommended) 优先 OpenRouter (gemini-2.5-flash) 免费版，防范 Rate Limit 时降级至 NVIDIA (llama-3.3-70b) 及 Workers AI。
- **Decision:** Prioritize OpenRouter gemini-2.5-flash for translations; fall back to NVIDIA and Workers AI on limit errors.

### 3. Batch Execution Limits
- **Question:** Which approach for Batch Execution Limits?
- **Selection:** (Recommended) 大批次单次运行（--limit=40），一次性生成所有草稿。
- **Decision:** High execution limit to capture all drafts in a single command.

### 4. Merging & Verification Workflow
- **Question:** Which approach for Merging & Verification Workflow?
- **Selection:** (Recommended) 批量生成草稿后一键合并，随后统一运行类型检查、标点校验脚本和冒烟测试。
- **Decision:** Merge via apply script, then run verify-cjk.js, typecheck, and dev-server smoke tests.
