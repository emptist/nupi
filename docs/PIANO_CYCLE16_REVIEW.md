# Piano Code Review - Cycle #16

## Review Summary

**Commit**: `02ac01d` [task:868d25c8-ca6f-4078-8fe1-3129266d1ccb]

**Files Changed**: 23 files, -2180 / +1738 lines

## Deleted Files (Potential Issues)

| File | Lines | Concern |
|------|-------|---------|
| `src/coordinator/TaskCoordinator.ts` | 208 | 任务协调逻辑被删除，如何处理？ |
| `src/router/TaskRouter.ts` | 94 | 任务路由逻辑被删除，如何处理？ |
| `src/planner/TaskPlanner.ts` | 130 | 任务规划逻辑被删除，如何处理？ |
| `src/engine/ContinuousWorkEngine.ts` | 215 | 持续工作引擎被删除，如何实现？ |
| `src/services/PianoHeartbeatService.ts` | 242 | 心跳服务被删除，如何保持活跃？ |
| `src/services/OpenCodeReminderService.ts` | 337 | 提醒服务被删除，如何触发提醒？ |
| `src/shared/capability.ts` | 29 | 能力定义被删除 |

## Issues Found

### 1. 缺失的功能替代

**问题**: 大量核心逻辑被删除，但似乎没有替代实现

- TaskCoordinator → 谁来协调任务？
- TaskRouter → 任务如何路由到正确的执行器？
- TaskPlanner → 任务如何规划优先级？
- ContinuousWorkEngine → 如何实现持续工作？

**需要确认**: 这些功能是被移除还是重构到了其他地方？

### 2. delegateToNezha 函数缺失

```typescript
// extensions/piano-autowork.ts:78
handler: async () => delegateToNezha(),
```

这个函数在当前代码中找不到定义，可能导致运行时错误。

### 3. piano-enhancement.ts 中的问题

查看 Cycle #16 改动，piano-enhancement.ts 从 218 行减少，需要确认：
- 是否也依赖了被删除的模块？
- 日志系统改变是否影响功能？

### 4. 移除的风险

删除测试文件 (`TaskPlanner.test.ts`, `TaskRouter.test.ts`) 可能导致：
- 回归问题无法被及时发现
- 重构风险增加

## Positive Changes

1. **shared-opencode.ts** - 好的模块化
   - 配置验证 (validateConfig)
   - 健康检查 (testHealth)
   - 自动重启 (restartIfNeeded)
   - 最多 3 次重试

2. **日志统一** - 使用 logger 替代 console.log

3. **类型声明** - 新增 `@mariozechner/pi-coding-agent` 类型

4. **配置验证** - 端口范围检查、密码长度检查

## Recommendations

1. 确认删除功能有替代实现，或添加 TODO 说明
2. 检查 delegateToNezha 函数是否存在
3. 考虑保留测试文件或添加替代测试
4. 文档更新 (README, DEVELOPER_GUIDE)

---

**Reviewer**: NuPI (Big-Pickle)
**Date**: 2026-04-09
**Context**: NuPI 改进任务完成后评审 Piano 最新变更