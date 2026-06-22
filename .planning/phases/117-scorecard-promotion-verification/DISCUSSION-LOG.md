# Phase 117 Discussion Log

Generated on: 2026-06-22

## Discussed Areas & Q&A

### 1. GSC Input Freshness
- **Question:** Which approach for GSC Input Freshness?
- **Selection:** (Recommended) 优先通过 `npm run report:gsc:fetch` 尝试获取真数据，在离线/无权限时使用最近缓存。
- **Decision:** Fetch live GSC inputs; fallback to latest cache if offline.

### 2. Expansion Gate Strictness
- **Question:** Which approach for Expansion Gate Strictness?
- **Selection:** (Recommended) 彻底关闭 `SEO_FORCE_EXPANSION_OPEN`，以真实指标跑 scorecard 晋级评审。
- **Decision:** Turn off SEO_FORCE_EXPANSION_OPEN for authentic scorecard validation.

### 3. Recovery Window Interpretation
- **Question:** Which approach for Recovery Window Interpretation?
- **Selection:** (Recommended) 诚实记入评审结果，即使因未达 2 个 promote 而保持扩容关闭（closed）也判定 Phase 117 成功通过。
- **Decision:** Accept and report scorecard findings honestly even if they keep the expansion gate closed.
