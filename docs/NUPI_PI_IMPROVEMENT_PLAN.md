# NuPI 改进计划 - 基于 Pi 深度研究

## 差距分析

NuPI 当前只使用了 Pi 约 10% 的能力。

### 1. 事件系统 (当前: 2个事件 → 需要: 30+)

**现状:**
- `session_start`
- `session_shutdown`

**Pi 有 30+ 事件:**
- `tool_call`, `tool_result`, `tool_execution_start/end`
- `before_agent_start`, `agent_start/end`
- `turn_start/end`, `message_start/update/end`
- `context` (每次 LLM 调用前)
- `input` (用户输入时)
- `session_before_compact`, `session_compact`
- `before_provider_request`

### 2. 自定义工具 (当前: 0 → 需要: 完整支持)

**现状:**
- 只有 8 个命令 (nupi-tasks, nupi-task-take 等)

**Pi 支持:**
- `pi.registerTool()` - 完整自定义工具
- Typebox schemas
- 自定义渲染
- 文件变更队列 (`withFileMutationQueue()`)

### 3. UI 交互 (当前: 未使用 → 需要: 完整)

**现状:**
- 未使用 ctx.ui

**Pi 支持:**
- `ctx.ui.notify()` - 通知
- `ctx.ui.confirm()` - 确认对话框
- `ctx.ui.select()` - 选择
- `ctx.ui.input()` - 输入
- `ctx.ui.setStatus()` - 状态行
- `ctx.ui.setWidget()` - 小部件
- 自定义 UI 组件

### 4. 消息注入 (当前: 基本 → 需要: 高级)

**现状:**
- 基本的 pi.sendUserMessage()

**Pi 支持:**
- `deliverAs: "steer"` - 当前轮后交付
- `deliverAs: "followUp"` - 完成后交付
- `deliverAs: "nextTurn"` - 下次轮交付
- `triggerTurn: true` - 立即触发

### 5. 工具拦截 (当前: 无 → 需要: 安全)

**Pi 支持:**
- 阻止危险命令
- 修改工具参数
- 权限门控

### 6. 状态管理 (当前: 无 → 需要: 持久化)

**Pi 支持:**
- `pi.appendEntry()` - 持久化状态到 session
- 状态重构

### 7. 模型控制 (当前: 静态 → 需要: 动态)

**Pi 支持:**
- 动态切换模型
- 调整 thinking level
- 自定义 provider

---

## 实现优先级

### P0 - 高价值
1. ✅ 命令注入漏洞修复 (已完成)
2. 添加工具拦截 (危险命令)
3. 改进消息注入 (deliverAs)
4. 状态持久化

### P1 - 中价值
5. 完整 UI 交互 (ctx.ui)
6. 动态工具注册
7. 模型动态切换

### P2 - 低价值
8. 高级事件处理
9. 完整自定义工具渲染

---

## 实现计划

### 阶段 1: 安全 + 消息注入
- [x] 命令注入修复 (已完成)
- [ ] 工具拦截 (阻止 rm -rf 等)
- [ ] 改进 deliverAs 模式

### 阶段 2: 状态管理
- [ ] appendEntry 持久化
- [ ] 状态重构

### 阶段 3: UI 交互
- [ ] ctx.ui.notify/confirm/select
- [ ] 自定义状态行

### 阶段 4: 高级功能
- [ ] 完整自定义工具
- [ ] 模型动态切换
- [ ] 高级事件处理
