# 移动端菜单重新设计

## 任务清单

- [x] 分析移动端菜单遮挡问题根因
- [x] 运行 UI UX PRO MAX 获取设计建议
- [x] 编写实施计划
- [x] 重构 `HeaderActions.tsx` 移动端菜单组件
- [x] 更新 `Header.astro` z-index 层级
- [x] 添加移动端菜单动画和 body 滚动锁定
- [x] 浏览器验证移动端菜单效果
- [x] 编写 walkthrough

## 移动端侧边栏优化
- [x] 分析侧边栏移动端行为
- [x] 实现 `SkillsSidebar.astro` 移动端折叠/展开功能
- [x] 添加当前选中分类显示
- [x] 验证移动端交互体验
- [x] 优化 AI 生成的 SEO 内容 (keywords, introduction, use cases)
  - [x] 更新 `scripts/lib/ai.ts` 中的 Prompt，增加 `definition`, `features` 等字段
  - [x] 修复 `generateAgentAnalysis` 中的 hallucination 问题 (防止复制示例)
  - [x] 验证 `algorithmic-art` 的生成结果
- [x] 优化 Agent Analysis 区域文案与 UI
  - [x] 更新 `zh.json` 将 "AI智能体兼容性" 改为 "Agent 专属能力分析" 等
  - [x] 更新 `en.json` 对应术语
  - [x] 微调 `[...repo].astro` 样式 (Core Value)
- [ ] 提交代码并推送
