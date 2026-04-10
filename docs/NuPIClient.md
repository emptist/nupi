# NuPIClient - HTTP API 客户端

NuPI 通过 HTTP API 连接到 Nezha (port 5999)。

## 基本用法

```typescript
import { getNuPIClient } from '@nezha/nupi';

const client = getNuPIClient();

// 或指定自定义 URL
const client = getNuPIClient('http://192.168.1.100:5999');
```

## API 端点

### 健康检查

```typescript
await client.health();           // → { status: 'ok', service: 'nezha' }
await client.isHealthy();        // → boolean
```

### 任务管理

```typescript
// 获取任务列表
await client.getTasks({ status: 'PENDING', limit: 10 });

// 获取待处理任务
const task = await client.getPendingTask();

// 创建任务
await client.createTask({ 
  title: 'New Task', 
  description: 'Description',
  priority: 8 
});

// 更新任务状态
await client.updateTaskStatus(taskId, 'RUNNING');
await client.updateTaskStatus(taskId, 'COMPLETED', { result: 'Done!' });
```

### 广播

```typescript
// 发送广播
await client.sendBroadcast('Hello from NuPI!', { 
  priority: 'high',
  to: 'S-nezha-piano-xxx'  // 可选：指定接收者
});

// 获取广播
await client.getBroadcasts(10);
```

### 记忆/学习

```typescript
// 保存学习
await client.saveMemory('Learned something', ['learn', 'nupi']);

// 搜索记忆
await client.searchMemory('query', 5);
```

### 身份

```typescript
// 获取当前 AI 身份
await client.getIdentity();
// → { agentId: 'S-nezha-nupi-xxx', ... }
```

### 系统状态

```typescript
// 获取系统统计
await client.getSystemStatus();
// → { pendingTasks: 5, openIssues: 2, memoryCount: 100 }
```

### 管理员功能

```typescript
// 恢复失败任务
await client.recoverFailedTasks({ maxRetries: 3 });

// 恢复卡住任务
await client.recoverStuckTasks();

// 重试 DLQ
await client.retryDLQ({ maxRetries: 5 });
```

## 错误处理

```typescript
try {
  const task = await client.getPendingTask();
} catch (error) {
  if (error instanceof NuPIClientError) {
    console.error(error.statusCode, error.message);
  }
}
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NUPI_URL` | `http://127.0.0.1:5999` | Nezha API 地址 |
| `NUPI_TIMEOUT` | `10000` | 请求超时 (ms) |

## 完整方法列表

| 方法 | 说明 |
|------|------|
| `health()` | 健康检查 |
| `isHealthy()` | 返回是否健康 |
| `getTasks(options?)` | 获取任务列表 |
| `getPendingTask(limit?)` | 获取待处理任务 |
| `createTask(data)` | 创建任务 |
| `updateTaskStatus(id, status, data?)` | 更新任务状态 |
| `getBroadcasts(limit?)` | 获取广播 |
| `sendBroadcast(message, options?)` | 发送广播 |
| `saveMemory(content, tags?)` | 保存记忆 |
| `searchMemory(query, limit?)` | 搜索记忆 |
| `getIdentity()` | 获取 AI 身份 |
| `getSystemStatus()` | 获取系统状态 |
| `recoverFailedTasks(options?)` | 恢复失败任务 |
| `recoverStuckTasks()` | 恢复卡住任务 |
| `retryDLQ(options?)` | 重试 DLQ |
| `getIssues(limit?)` | 获取问题列表 |
