# Context: Phase 93 (Smart Fallback & Degradation Verification)

## Objective
验证和增强路由决策系统的容灾退回与降级机制（Smart Fallback & Degradation）。编写全面的 Vitest 测试套件，模拟各种极端及边界故障场景，如 429 报错限流、Provider 密钥丢失、服务冷却/熔断、以及未在 Operator Profile 中声明的 Provider 锁定退回等，以确保系统在实际运行中能无缝并安全地进行流量路由降级。

## Scope
1. **测试用例覆盖 (Vitest Tests)**:
   - **429 Cooldown/Circuit Breaker 降级退回**: 模拟主 Provider (NVIDIA) 遭遇 429 错误触发冷却（`coolingDown`）或熔断（`circuitBreakerOpen`）。验证 `buildProviderRoutingPlan` 正确做出 `backup_recovery` 决策，并过滤掉故障主 Provider。
   - **密钥丢失/未配置退回**: 模拟未配置 NVIDIA（`nvidiaConfigured: false`）或 Primary 候选者可用性为 false，验证在不同 Fallback 策略（如 `guarded`、`always`）下的降级逻辑。
   - **Provider 锁定退回路径**: 验证若某些 Backup Provider 被标记为 `hardDisabled` 或在 `stateByLabel` 中熔断，退回路径只会锁定在其他健康的已声明备份 Provider，如果所有 Provider 均不可用，应正确返回 `providers_exhausted`。
   - **预算与速度 Profile 排序验证**: 结合 Phase 92 引入的 `budget` 和 `speed` Profile，验证在其对应的 Operator Profile 下，Backup Provider 的排序依据其估计成本（`estimatedCostPer1k`）或平均延迟（`averageLatencyMs`）正确排列。

## Target Files
- [ai-provider-routing.test.ts](file:///Users/kaka/Dev/Killer-Skills/src/lib/ai-provider-routing.test.ts)

## Success Criteria
1. 在 `src/lib/ai-provider-routing.test.ts` 中新增上述降级与退回的场景测试用例。
2. 所有新增的 Vitest 测试用例和已有的测试用例全部通过。
3. 测试覆盖率和诊断信息清晰，无未处理的 ESLint/TypeScript 静态检测错误。
