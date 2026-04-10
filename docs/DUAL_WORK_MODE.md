# NuPI 双工作模式设计

## 概述

NuPI 设计两种工作模式，适配不同的使用场景。

## 背景研究

深入研究 pi-mono 源码后发现：
- Pi 已有成熟的 **subagent 机制** (examples/extensions/subagent/)
- 支持 spawn 独立 pi 进程执行
- 支持 Single/Parallel/Chain 模式

## 模式 1: 独立模式 (Standalone Mode)

**特点**: NuPI 自主工作，使用本地 Pi + 数据库，不依赖外部 AI。

```
┌─────────────────────────────────┐
│           NuPI                    │
│  ┌─────────────────────────┐     │
│  │   Local Pi              │     │
│  │ (glm-4.5-flash)        │     │
│  └─────────────────────────┘     │
│              ↓                   │
│  ┌─────────────────────────┐     │
│  │   PostgreSQL          │     │
│  │ (tasks/issues)        │     │
│  └─────────────────────────┘     │
└─────────────────────────────────┘
```

**使用场景**:
- 本地模型足够强
- 不需要外部 AI 协作
- 离线工作

## 模式 2: 外挂模式 (External Mode)

**特点**: 思考能力通过 Pi 的 subagent 机制交付给外部 AI。

```
┌───────────────────────────────────────────────────┐
│                   NuPI                          │
│                                                   │
│  ┌─────────────────────────────────────────┐    │
│  │    Pi with subagent extension            │    │
│  │                                          │    │
│  │  ┌─────────┐    ┌─────────┐             │    │
│  │  │ scout   │ →  │ planner │ → worker    │    │
│  │  └─────────┘    └─────────┘             │    │
│  │       ↓              ↓                  │    │
│  │  ┌───────────────────────────────────┐  │    │
│  │  │  External AI (Piano/OpenCode)    │  │    │
│  │  │     via pi subagent spawn         │  │    │
│  │  └───────────────────────────────────┘  │    │
│  └─────────────────────────────────────────┘    │
│                         ↓                       │
│  ┌─────────────────────────┐                  │
│  │   PostgreSQL            │                  │
│  └─────────────────────────┘                  │
└───────────────────────────────────────────────────┘
```

### Pi Subagent 机制

Pi subagent 支持三种模式：

| 模式 | 参数 | 描述 |
|------|------|------|
| Single | `{ agent, task }` | 一个代理，一个任务 |
| Parallel | `{ tasks: [...] }` | 并行执行 (最多8个，同时4个) |
| Chain | `{ chain: [...] }` | 顺序执行 scout→planner→worker |

### 子代理定义示例

```markdown
---
name: my-agent
description: What this agent does
tools: read, grep, find, ls
model: claude-sonnet-4-5
---

System prompt for the agent goes here.
```

### 外挂流程

1. **定义子代理**: 连接到 Piano 的子代理配置
2. **NuPI 调用**: 使用 `subagent` 工具
3. **Piano 处理**: spawn 代理进程执行
4. **返回结果**: pipeline 传回 NuPI

```typescript
// NuPI 调用外部子代理
pi.registerTool({
  name: "delegate",
  parameters: Type.Object({
    task: Type.String(),
    mode: Type.Enum(["single", "parallel", "chain"]),
    externalUrl: Type.String(),
  }),
  async execute(toolCallId, params, signal) {
    // 调用外部 API
    const result = await fetch(params.externalUrl, {
      method: 'POST',
      body: JSON.stringify({ task: params.task }),
    });
    return { content: [{ text: result.output }] };
  },
});
```

## 实现计划 (基于 Pi Subagent + Piano 反馈)

### Phase 1: 研究 Pi Subagent ✅
- [x] 发现 Pi 已有内置 subagent 机制
- [x] 研究 subagent 的 spawn 机制
- [x] 理解 Chain 模式的 message 传递

### Phase 2: 设计 API (进行中)
- [x] 外挂模式 API 设计 (OpenCode 集成)
- [ ] 添加 external agents 配置
- [ ] Chain 模式 API

### Phase 3: 外挂模式 (基于 Pi Subagent)
- [ ] 集成 Pi subagent 扩展
- [ ] 配置外部子代理 (Piano/OpenCode)
- [ ] 实现 delegation 工具

### Phase 4: 测试
- [ ] 单代理测试
- [ ] 并行测试
- [ ] Chain 测试

### Piano 反馈要点
1. 完美匹配 Piano 需求
2. 外挂模式 API 需考虑 OpenCode 集成
3. Chain 模式支持 (scout→Piano→worker)
4. Task #f71c0e11 进行中

## 使用示例

### NuPI 外挂模式配置

```typescript
import { NuPI } from '@nezha/nupi';

const nupi = new NuPI({
  mode: 'external',
  agents: {
    scout: { url: 'http://piano:8080/agent/scout', tools: ['read', 'grep'] },
    planner: { url: 'http://piano:8080/agent/planner' },
    worker: { url: 'http://piano:8080/agent/worker' },
  },
});

// Chain 模式
await nupi.delegate({
  chain: [
    { agent: 'scout', task: 'Find auth code {previous}' },
    { agent: 'planner', task: 'Plan improvements {previous}' },
    { agent: 'worker', task: 'Implement {previous}' },
  ],
});
```

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