# NuPI (牛派)

**NuPI** = Nezha united with PI

**独立 AI 系统**，通过 HTTP API 与 Nezha 协作，不依赖 MCP。

---

## 快速开始

### 启动 NuPI

```bash
nupi              # 启动 NuPI 模式 (本地 LLM)
```

这会启动 Pi 并加载 NuPI 扩展。

### 命令

| 命令 | 说明 |
|------|------|
| `/nupi-status` | 系统状态 (tasks, issues, memory) |
| `/nupi-tasks` | 查看待办任务 |
| `/nupi-task-take <id>` | 领取任务 |
| `/nupi-task-done <id>` | 完成任务 |
| `/nupi-issues` | 查看开放问题 |
| `/nupi-learn <insight>` | 保存学习 |
| `/nupi-search <query>` | 搜索记忆 |
| `/nupi-work` | 自主工作模式 |

---

## 架构

```
NuPI (本地 LLM) ←HTTP API (4099)→ Nezha (PostgreSQL)
```

- **NuPI**: 执行层，使用 Pi + 本地 LLM (Ollama)
- **Nezha**: 服务层，提供 API (port 4099)、数据库、任务系统

### API 端点

Nezha API server 运行在 `http://127.0.0.1:4099`:

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/health/detailed` | GET | 详细健康状态 |
| `/tasks` | GET | 任务列表 |
| `/tasks` | POST | 创建任务 |
| `/tasks/:id/status` | PUT | 更新任务状态 |
| `/tasks/:id/result` | PUT | 更新任务结果 |
| `/issues` | GET | 问题列表 |
| `/issues` | POST | 创建问题 |
| `/memory` | POST | 保存记忆 |
| `/memory/search` | GET | 搜索记忆 |
| `/broadcast` | GET | 广播列表 |
| `/broadcast` | POST | 发送广播 |
| `/identity` | GET | AI 身份 |
| `/status` | GET | 系统状态 |
| `/table-documentation` | GET | 表文档 |
| `/admin/recovery/*` | POST | 恢复管理 |

---

## 与 Nezha API 交互

### NuPIClient (推荐)

```typescript
import { getNuPIClient } from '@nezha/nupi';

const client = getNuPIClient();

// 获取待处理任务
const task = await client.getPendingTask();

// 创建新任务
const { id } = await client.createTask({ title: 'New Task', priority: 8 });

// 更新任务状态
await client.updateTaskStatus(taskId, 'RUNNING');

// 保存学习
await client.saveMemory('Learned something', ['learn', 'nupi']);

// 广播消息
await client.sendBroadcast('Hello from NuPI!', { priority: 'high' });
```

### 直接 HTTP 调用

```bash
# 健康检查
curl http://127.0.0.1:4099/health

# 获取待处理任务
curl "http://127.0.0.1:4099/tasks?status=PENDING&limit=5"

# 创建任务
curl -X POST http://127.0.0.1:4099/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "New Task", "priority": 8}'

# 保存学习
curl -X POST http://127.0.0.1:4099/memory \
  -H "Content-Type: application/json" \
  -d '{"content": "Learned something", "tags": ["learn", "nupi"]}'
```

---

## 使用 nezha CLI

NuPI 项目已 npm link nezha，可以直接使用：

```bash
# 查看任务
node ./node_modules/.bin/nezha tasks

# 查看 issues
node ./node_modules/.bin/nezha issues list

# 广播
node ./node_modules/.bin/nezha share "message"

# 保存学习 (areflect)
node ./node_modules/.bin/nezha areflect "[LEARN] insight: 学到的内容"

# 检查待办
node ./node_modules/.bin/nezha areflect --check
```

---

## 开发

### Prerequisites

- Node.js 20+
- PostgreSQL (nezha database)
- Pi (TUI)
- `npm link nezha`

### Setup

```bash
npm install
npm link nezha
npm run build
```

### Commands

```bash
npm run typecheck  # 类型检查
npm run build      # 构建
npm run test       # 单元测试 (vitest)
```

### 测试

```bash
# 运行测试
npm run test

# 监听模式
npm run test -- --watch

# 覆盖率
npm run test -- --coverage
```

测试文件位于 `src/**/*.test.ts`

### Pi 扩展部署

```bash
# 复制扩展
cp extensions/*.ts ~/.pi/agent/extensions/

# 复制 memory
cp .memory/*.md ~/.pi/agent/extensions/
```

---

## 目录结构

```
nupi/
├── src/
│   └── services/
│       ├── NuPIClient.ts     # HTTP API 客户端
│       ├── PiExecutor.ts     # 本地 LLM 执行器
│       └── PiSDKExecutor.ts # Pi SDK 执行器
├── extensions/
│   ├── nupi-tools.ts         # 数据库工具 (HTTP API)
│   └── nupi-autowork.ts      # 永续工作循环 v2.1
├── skills/
│   └── nupi-abc/SKILL.md     # AI 必读
└── .memory/                  # 启动记忆
    └── MEMORY.md
```

---

## 与其他项目关系

| 项目 | 职责 |
|------|------|
| NuPI | 独立 AI，使用本地 LLM |
| Nezha | 数据库服务，API server |
| Piano | NuPI + OpenCode (任务路由) |

---

## 本地 LLM

- **Model**: glm-5, llama3.2:3b 等
- **Embedding**: nomic-embed-text

零 API 成本，24/7 运行。