# NuPI Developer Guide

## 身份声明

**我是 NuPI AI**，不是 nezha！

| 项目 | 职责 |
|------|------|
| NuPI | 独立 AI，使用 Pi + 本地 LLM |
| Nezha | 数据库服务 + API server (port 4099) |
| Piano | NuPI + OpenCode (任务路由) |

---

## Architecture

```
NuPI ←HTTP API (4099)→ Nezha (PostgreSQL)
```

- **NuPI**: 执行层，Pi + 本地 LLM (Ollama)
- **Nezha**: 服务层，API + DB + 任务/记忆/广播

### NuPIClient

```typescript
import { getNuPIClient } from '@nezha/nupi';

const api = getNuPIClient();

// Tasks
const task = await api.getPendingTask(1);
await api.updateTaskStatus(taskId, 'RUNNING');

// Issues
const issues = await api.getIssues(10);

// Memory
await api.saveMemory('learned', ['tag']);
const results = await api.searchMemory('query');

// System
const status = await api.getSystemStatus();
```

---

## Getting Started

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

### Development Workflow

1. 修改代码
2. `npm run typecheck`
3. `npm run build`
4. 提交 (包含 task ID)
5. 推送到远程

---

## Using nezha CLI

NuPI 已 npm link nezha，直接使用：

```bash
# 查看任务
node ./node_modules/.bin/nezha tasks

# 查看 issues
node ./node_modules/.bin/nezha issues list

# 广播
node ./node_modules/.bin/nezha share "message"

# areflect - 保存学习/创建 issue/task
node ./node_modules/.bin/nezha areflect "[LEARN] insight: ..."
node ./node_modules/.bin/nezha areflect "[ISSUE] title: ... severity:high"
node ./node_modules/.bin/nezha areflect "[TASK] title: ... priority:8"

# 检查待办
node ./node_modules/.bin/nezha areflect --check

# 查看最近学习
node ./node_modules/.bin/nezha areflect --learnings
```

---

## Pi Extensions

### 部署

```bash
# 复制扩展到 Pi
cp extensions/*.ts ~/.pi/agent/extensions/

# 复制 memory
cp .memory/*.md ~/.pi/agent/extensions/
```

### Commands

| Command | Description |
|---------|-------------|
| `/nupi-tasks` | List pending tasks |
| `/nupi-task-take <id>` | Take a task |
| `/nupi-task-done <id>` | Complete a task |
| `/nupi-issues` | List open issues |
| `/nupi-learn <insight>` | Save learning |
| `/nupi-search <query>` | Search memory |
| `/nupi-status` | System status |
| `/nupi-work` | Autonomous work mode |

---

## nupi-autowork v2.1

自动工作循环：

1. 会话启动时检查并确保 Nezha API 运行
2. 每 2 分钟自动检查任务/issue/broadcast
3. 主动推送工作给 AI（不需要等人类分配）

```typescript
// 自动启动 nezha 如果未运行
await ensureNezhaApiRunning();

// 定期检查工作
setInterval(checkAndDeliverWork, 2 * 60 * 1000);
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/services/NuPIClient.ts` | HTTP API 客户端 (port 4099) |
| `src/services/PiExecutor.ts` | 本地 LLM 执行器 |
| `src/services/PiSDKExecutor.ts` | Pi SDK 执行器 |
| `extensions/nupi-tools.ts` | Pi 扩展 - 数据库工具 |
| `extensions/nupi-autowork.ts` | Pi 扩展 - 永续工作循环 |

---

## Commands

```bash
npm run typecheck  # Type check
npm run build      # Build
npm run test      # Tests
```

---

## Git Branch Strategy

- `master` - stable
- `phase2-nupi-cleanup` - 当前开发分支
- `fix/*` - bug fixes
- `feat/*` - new features

---

## Cross-AI Collaboration

通过共享数据库协作：

```bash
# 广播
nezha share "message"

# 创建 issue/task
nezha areflect "[ISSUE] title: ..."

# 保存学习
nezha areflect "[LEARN] insight: ..."
```

---

## NuPI 与 Piano 共享

`nupi-tools.ts` 在两个项目使用相同模式：

- **NuPI**: 直接使用 NuPIClient
- **Piano**: 通过 HTTP API 调用

---

## Troubleshooting

### Port 4099 未运行

```bash
# 启动 Nezha
cd ~/gits/hub/tools_ai/nezha
node ./dist/cli/index.js start
```

### 数据库连接

```bash
psql -U postgres -d nezha -c "SELECT 1;"
```

环境变量：
```bash
NEZHA_DB_HOST=localhost
NEZHA_DB_PORT=5432
NEZHA_DB_NAME=nezha
```

---

## Important Notes

1. **NuPI is independent** - 不需要 OpenCode 或 MCP
2. **npm link nezha** - 可直接使用 nezha CLI 和模块
3. **Sync Pi extensions** - 更新后复制到 `~/.pi/agent/extensions/`
4. **HTTP API** - 使用 port 4099 与 Nezha 通信
5. **areflect** - 不需要 MCP，直接用 nezha CLI