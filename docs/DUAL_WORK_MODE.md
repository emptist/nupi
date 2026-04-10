# NuPI 双工作模式设计

## 概述

NuPI 设计两种工作模式，适配不同的使用场景。

## 模式 1: 独立模式 (Standalone Mode)

**特点**: NuPI 自主工作，使用本地 Pi + 数据库，不依赖外部 AI。

```
┌─────────────────────────────────┐
│           NuPI                    │
│  ┌─────────────────────────┐    │
│  │   Local Pi          │    │
│  │ (glm-4.5-flash)  │    │
│  └─────────────────────────┘    │
│              ↓                │
│  ┌─────────────────────────┐    │
│  │   PostgreSQL      │    │
│  │ (tasks/issues)   │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

**使用场景**:
- 本地模型足够强
- 不需要外部 AI 协作
- 离线工作

**当前实现**:
- `PiExecutor.execute()` - 本地执行
- `NuPIClient` - 数据库操作
- 自动工作循环 (nupi-autowork.ts)

## 模式 2: 外挂模式 (External Mode)

**特点**: 思考能力通过 API 交付给外部 AI (Piano/OpenCode)，NuPI 只负责执行。

```
┌─────────────────────────────────┐
│           NuPI                    │
│  ┌─────────────────────────┐    │
│  │  Execution Only    │    │
│  │ (no thinking)    │    │
│  └─────────────────────────┘    │
│              ↑ think()         │
│              │ API           │
│              ↓              │
│  ┌─────────────────────────┐    │
│  │   External AI        │    │
│  │ (Piano/OpenCode)   │    │
│  └─────────────────────────┘    │
│              ↓ result          │
│              ↓                │
│  ┌─────────────────────────┐    │
│  │   PostgreSQL      │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

**使用场景**:
- 本地模型不够强
- 需要外部 AI 协作
- Piano 完全控制思考过程

## 核心 API 设计

### 1. 模式切换

```typescript
import { NuPI, WorkMode } from '@nezha/nupi';

const nupi = new NuPI({
  mode: 'standalone', // 或 'external'
  externalApi: 'http://piano:8080/think',  // 外挂 API 地址
});
```

### 2. think() - 思考接口

```typescript
// 独立模式: 使用本地 Pi
const result = await nupi.think('分析这个代码问题');

// 外挂模式: 交付给外部 API
const result = await nupi.thinkExternal({
  task: '分析这个代码问题',
  context: { file: 'src/index.ts', error: '...' },
  timeout: 60000,
});
```

### 3. executeWithThinking() - 带思考的执行

```typescript
// 完整工作流程
const result = await nupi.executeWithThinking({
  task: '修复这个 bug',
  // 自动: think() → execute → save result
});
```

### 4. 任务分配接口

```typescript
// 接收外部任务
nupi.onExternalTask(async (task) => {
  const result = await nupi.execute(task);
  return result;
});

// 分配给外部
const externalResult = await nupi.delegateToExternal({
  task: '需要思考的任务',
  priority: 8,
});
```

## 实现计划

### Phase 1: 接口定义
- [ ] 定义 WorkMode 类型
- [ ] 定义 ThinkRequest/ThinkResponse
- [ ] 定义 ExternalTask 接口

### Phase 2: 独立模式增强
- [ ] 改进本地 Pi Executor
- [ ] 添加思考缓存

### Phase 3: 外挂模式实现
- [ ] 实现 thinkExternal()
- [ ] 实现 delegateToExternal()
- [ ] 实现 onExternalTask hook

### Phase 4: 集成 Piano
- [ ] Piano 调用 NuPI think API
- [ ] NuPI 接收 Piano 返回

## 使用示例

### Piano 使用 NuPI 外挂模式

```typescript
// Piano 侧
import { getNuPIClient } from '@nezha/nupi';

const client = getNuPIClient();

// 1. 分配任务给 NuPI
const task = await client.createTask({
  title: '修复 bug',
  description: '...',
});

// 2. NuPI 调用 Piano 的 think API
const thinking = await fetch('http://piano:8080/think', {
  method: 'POST',
  body: JSON.stringify({ task }),
});

// 3. NuPI 执行并返回结果
await client.updateTaskStatus(task.id, 'COMPLETED', {
  result: execution.output,
});
```

### NuPI 外挂模式配置

```typescript
const nupi = new NuPI({
  mode: 'external',
  externalApi: process.env.THINK_API_URL,
  autoDelegate: true,  // 自动分配需要思考的任务
  timeout: 120000,
});
```

## 错误处理

```typescript
try {
  const result = await nupi.thinkExternal({ task: '...' });
} catch (error) {
  if (error.code === 'EXTERNAL_TIMEOUT') {
    // 回退到本地模式
    return await nupi.think(task);
  }
  if (error.code === 'EXTERNAL_UNAVAILABLE') {
    // 使用本地 Pi
    return await nupi.thinkLocal(task);
  }
}
```