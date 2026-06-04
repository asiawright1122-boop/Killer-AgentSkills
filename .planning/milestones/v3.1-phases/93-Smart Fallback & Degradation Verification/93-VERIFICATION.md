---
phase: 93-smart-fallback-degradation-verification
requirements_completed:
  - AIOPS-14
---

# Verification: Phase 93 (Smart Fallback & Degradation Verification)

## Automated Unit Tests
- 执行 AI 提供商路由的单元测试套件：
  ```bash
  npx vitest run src/lib/ai-provider-routing.test.ts
  ```
- 运行 TypeScript 类型检查以确保所有新增测试的参数类型完备无误：
  ```bash
  npm run typecheck
  ```
- 运行全局的 build 校验，确保测试没有阻碍整体构建流程：
  ```bash
  npm run build
  ```

## Expected Outcomes
1. 所有关于 Fallback 和 Degradation 的单元测试用例全部通过，测试中没有发生未捕获的错误。
2. 类型检查无报错。
3. 单元测试覆盖以下核心场景：
   - NVIDIA 发生 429 报错或冷却时退回到备份 Provider。
   - NVIDIA 未配置时在 guarded 模式下激活备份。
   - 部分备份 Provider 熔断或禁用时锁定到剩余健康的备份。
   - 所有 Provider 都不可用时输出 `providers_exhausted` 决策。
   - `budget` 和 `speed` 偏好的 Operator Profile 分别根据成本和延迟正确定位备份 Provider 的顺序。
