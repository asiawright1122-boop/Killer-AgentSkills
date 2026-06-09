# Phase 114 Discussion Log

Generated on: 2026-06-09

## Discussed Areas & Q&A

### 1. LLM Provider & Model Selection
- **Question:** Which approach for LLM Provider & Model Selection?
- **User input:** "我们配置了好几个NVIDA的APIKEY,SILICONFLOW和OPENROUTER，就是要免费！"
- **Decision:** Prioritize free tier endpoints from NVIDIA/SiliconFlow/OpenRouter; fall back to free Cloudflare Workers AI.

### 2. Batch & Retry Strategy
- **Question:** Which approach for Batch & Retry Strategy?
- **Selection:** (Recommended) 优雅退避与容错: 遇到错误进行最大 3 次指数退避重试；某页永久失败时记录错误并跳过，继续生成下一页，不中断脚本，最终输出汇总报告。
- **Decision:** Exponential backoff retries with graceful error tolerance.

### 3. Review & Overwrite Workflow
- **Question:** Which approach for Review & Overwrite Workflow?
- **Selection:** (Recommended) 临时草稿文件 (Draft-First) 模式: 生成内容先写入 `data/enrichment-drafts.json`，经 review 确认无误后，再通过辅助命令一次性合并到 collections JSON 文件中。
- **Decision:** Draft-First mode using a staging JSON file.

### 4. Translation & Localization Flow
- **Question:** Which approach for Translation & Localization Flow?
- **Selection:** (Recommended) 混合生成与翻译模式: 大模型先生成高标准的英文版元数据，随后调用独立的翻译模块/脚本，自动增量翻译到其他 9 种语言，保证数据一致性且不易因单次输出过大损坏 JSON。
- **Decision:** Generate English first, then translate into other 9 languages.

### 5. Translation Cache & Incremental Translation
- **Question:** Which approach for Translation Cache & Incremental Translation?
- **Selection:** (Recommended) 增量保留模式: 只要目标语言已有的 Description 长度符合标准且非空，就予以保留，不执行 API 翻译。只对缺失或过短（thin）的 Locale 运行翻译。这样可保护人工调优后的多语种文本，并节省 API 开销。
- **Decision:** Skip translation for non-thin existing descriptions to preserve manual adjustments and minimize costs.

### 6. Generation Prompt Style & Constraints
- **Question:** Which approach for Generation Prompt Style & Constraints?
- **Selection:** (Recommended) 混合防御模式: 在 Prompt 中融入 public-copy-boundary 过滤词指令（避免输出 review, validation 等黑名单词汇），要求描述兼具实用价值（解决什么工作流）与专业规范，且强制结尾带标点。
- **Decision:** Inject copy filters directly into the LLM system prompt; enforce ending punctuation and target user-centric value.
