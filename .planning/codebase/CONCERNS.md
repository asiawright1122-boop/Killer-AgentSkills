# Technical Concerns & Debt

## 🔴 Critical

### 1. Git 仓库 8.3GB 严重膨胀
- **根因**: `db/seeds/` 279MB (133 SQL) + `embeddings-cache.json` 40MB 反复提交
- **影响**: Clone 极慢，CI checkout 时间长，仓库不可持续
- **修复**: gitignore + `git rm --cached` + 历史清理

### 2. 1997/3504 Skills SEO 不达标 (57%)
- **根因**: prompt v3→v4 升级后旧数据未重生成
- **状态**: 管线已就绪，定时运行自动修复中

### 3. 29 个死脚本 + 5 组重复脚本 (~2120 行冗余)
- **影响**: 维护负担，新开发者困惑，潜在使用错误脚本
- **详细清单**: 见 [deep_audit_report.md](file:///Users/kaka/.gemini/antigravity/brain/b4256677-5060-4bfa-b559-d4477adb74dc/deep_audit_report.md)

## 🟠 Medium

### 4. Admin 硬编码默认密码 admin/admin
- **文件**: `src/middleware-utils.ts:151`
- **缓解**: Middleware L64 优先读环境变量，但未配置则暴露

### 5. `build-skills-cache.ts` 2514 行 + `ai.ts` 1367 行
- 两个超大文件各含 3-4 个职责，应拆分

### 6. `.claude/worktrees/` 残留 331MB
- 已完成的 agent worktree 未清理

### 7. sitemap-skills 差 32 个 repo
- `sitemap-skills.json` 2941 vs `skills-cache.json` 2973

## 🟡 Minor

### 8. Collections 无多语言本地化 (35 JSON 仅英文)
### 9. Skill 详情页 1252 行应拆分子组件
### 10. `db/seeds/` 279MB 应移出 git

## 已验证安全

| 检查 | 结论 |
|------|------|
| 4 Workflow 覆写冲突 | ✅ 无冲突 |
| i18n 管线顺序 | ✅ 正确 |
| 增量逻辑 | ✅ 12 条件检查 |
| AI prompt 主题约束 | ✅ 严格 |
| Layout SEO | ✅ hreflang/canonical/OG 全覆盖 |
| Rate limiting | ✅ 关键 API 已保护 |
| Security headers | ✅ 已设置 |
| 博客 frontmatter | ✅ 全部合格 |
