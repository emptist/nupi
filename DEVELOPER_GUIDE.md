# NuPI Developer Guide

## 身份声明

**我是 NuPI AI**，不是 nezha！

| 项目 | 职责 |
|------|------|
| NuPI | 独立 AI，使用 Pi 执行任务 |
| Nezha | 数据库服务（共享） |
| Piano | NuPI + OpenCode |

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL (nezha database)
- Pi (TUI) installed (optional, only for TUI mode)
- npm link to nezha: `npm link nezha`

**NuPI is independent** - no MCP, no OpenCode dependency required!

### Setup

```bash
# Install dependencies
npm install

# Link nezha (npm package)
npm link nezha

# Build
npm run build
```

### Development Workflow

1. Make changes in nupi
2. Test with `npm run typecheck`
3. Build with `npm run build`
4. Commit (hook will add agent ID)
5. Push to remote

### Git Branch Strategy

- `master` - stable
- `fix/*` - bug fixes
- `feat/*` - new features

---

## Architecture

```
NuPI = Pi + Nezha (二合一)
```

- Local LLM execution (Ollama)
- Zero API cost
- Cross-AI collaboration via shared PostgreSQL

### Cross-AI Collaboration

NuPI works with other AIs through shared database:

```bash
# Broadcast to all AIs
node ./node_modules/.bin/nezha share "message"

# Create issue
node ./node_modules/.bin/nezha areflect "[ISSUE] title: ..."

# Check tasks
node ./node_modules/.bin/nezha tasks --status PENDING
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/services/PiExecutor.ts` | Execute local LLM via CLI |
| `src/services/PiSDKExecutor.ts` | Execute via Pi SDK |
| `src/services/NuPIHeartbeatService.ts` | Heartbeat service (uses nezha) |
| `src/services/TraeAutoRecoveryService.ts` | Trae integration |
| `src/services/TraeSkillSyncService.ts` | Trae skill sync |

---

## Using nezha npm Package

NuPI can reuse nezha's exported functionality:

```typescript
// Reuse HeartbeatService
import { HeartbeatService, Config, logger } from 'nezha';
import { DatabaseClient } from 'nezha/dist/db/DatabaseClient.js';

const db = new DatabaseClient(Config.getInstance());
const heartbeat = new HeartbeatService(db, {
  heartbeatIntervalMs: 60000,
  enableReminder: true,
});
await heartbeat.start();
```

**Available exports from nezha**:
- `HeartbeatService` - heartbeat service
- `Config` - configuration
- `logger` - logging
- `TASK_STATUS`, `DATABASE_TABLES` - constants
- `ReminderTemplateService` - reminder templates

### NuPIClient API

NuPIClient 提供 HTTP API 访问 nezha 服务：

```typescript
import { getNuPIClient } from '@nezha/nupi';

const api = getNuPIClient();

// Tasks
const task = await api.getPendingTask(1);
await api.updateTaskStatus(taskId, 'RUNNING');

// Issues
const issues = await api.getIssues(10);
await api.updateTaskError(taskId, 'error message');

// Broadcasts
await api.sendBroadcast('message', { priority: 'high' });
const broadcasts = await api.getBroadcasts(5);

// Memory
await api.saveMemory('learned something', ['tag1', 'tag2']);
const results = await api.searchMemory('query');

// System
const status = await api.getSystemStatus();
const health = await api.isHealthy();

// Extended API (v2.1+)
await api.getReminderTemplate('default_reminder');
await api.getAllReminderTemplates();
await api.getHealthStatus();
await api.getTableDocumentation('tasks');
await api.searchCodebase('search term');
await api.getAgentSessions();
await api.triggerReminder();
```

### PiExecutor 增强

PiExecutor 新增 `findWorkFromNezha()` 方法：

```typescript
import { getPiExecutor } from '@nezha/nupi';

const executor = getPiExecutor();
const work = await executor.findWorkFromNezha();

// work: { type: 'task' | 'issue' | 'broadcast', id, title, description?, priority?, severity? }
```

---

## Pi Extensions

Extensions are in two locations (must sync both):

| Location | Purpose |
|----------|---------|
| `extensions/*.ts` | Source code (git tracked) |
| `~/.pi/agent/extensions/` | Runtime (deployed) |

### Deploy to Pi

```bash
# Copy extensions to Pi
cp extensions/*.ts ~/.pi/agent/extensions/

# Copy skills
cp -r skills/* ~/.pi/agent/skills/

# Copy memory
cp -r .memory/* ~/.pi/agent/extensions/
```

### Pi Extension Commands

Extensions in two locations (must sync):

| Location | Purpose |
|----------|---------|
| `extensions/*.ts` | Source code (git tracked) |
| `~/.pi/agent/extensions/` | Pi runtime |

**与 Piano 共享** - `nupi-tools.ts` 在两个项目使用相同模式：
- NuPI: 直接使用 `src/services/NuPIClient.ts`
- Piano: 通过 HTTP API 调用 NuPI 服务

---

## Commands

```bash
npm run typecheck  # Type check
npm run build      # Build
npm run test      # Tests
```

### nupi Launch Script

NuPI launcher at `/usr/local/bin/nupi`:

```bash
nupi              # Start NuPI mode (local LLM)
```

### Using nezha CLI

```bash
# View tasks
node ./node_modules/.bin/nezha tasks

# View issues
node ./node_modules/.bin/nezha issues list

# Share message
node ./node_modules/.bin/nezha share "message"

# Create issue/task/learning (areflect)
node ./node_modules/.bin/nezha areflect "[ISSUE] title: ..."
node ./node_modules/.bin/nezha areflect "[TASK] title: ... priority:8"
node ./node_modules/.bin/nezha areflect "[LEARN] insight: ..."
```

### nezha areflect - 不需要 MCP

NuPI 已 npm link nezha，可以直接使用 nezha CLI 保存学习，不需要 MCP：

```bash
# 保存学习（推荐方式）
node ./node_modules/.bin/nezha areflect "[LEARN] insight: 学到的内容 context: 上下文"

# 检查待办
node ./node_modules/.bin/nezha areflect --check

# 查看最近学习
node ./node_modules/.bin/nezha areflect --learnings
```

支持的标记：`[ISSUE]`、`[TASK]`、`[LEARN]`、`[ANNOUNCE]`、`[SCHEDULE]`

---

## Pi 启动时自动加载

Pi 启动时会自动加载以下内容：

### 1. Skills (自动读取)

`skills/` 目录下的 SKILL.md 会在每次新会话开始时自动读取：

```bash
skills/nupi-abc/SKILL.md  # 会被自动加载
```

SKILL.md 中的 `triggers` 字段定义触发条件。

### 2. .memory 目录 (需要复制)

`.memory/MEMORY.md` 需要手动复制到 Pi 运行时目录：

```bash
# 部署时复制
cp -r .memory/* ~/.pi/agent/extensions/
```

### 3. Extensions (手动加载)

扩展需要在 Pi 启动时手动启用，或复制到 `~/.pi/agent/extensions/`

---

## Important Notes

1. **NuPI is independent** - doesn't need OpenCode or MCP
2. **npm link nezha** - can reuse nezha's exported functionality
3. **Sync Pi extensions** - update both source and `~/.pi/agent/extensions/`
4. **Cross-AI** - use shared database for collaboration

---

## Troubleshooting

### CLI not working

If `nezha` command fails with "import: command not found", use:
```bash
node ./node_modules/.bin/nezha tasks
```

This is a known bug - nezha CLI missing shebang.

### Database connection

Ensure PostgreSQL is running:
```bash
psql -U postgres -d nezha -c "SELECT 1;"
```

Set env vars if needed:
```bash
NEZHA_DB_HOST=localhost
NEZHA_DB_PORT=5432
NEZHA_DB_NAME=nezha
```

---

## GitHub Integration

### GitHub Sync Service

High priority issues (severity: high/critical) automatically sync to GitHub:
- GitHub: https://github.com/emptist/nezha
- Uses `[ISSUE] severity:high` trigger
- Solves 450+ pending issues noise problem

### Dual-Channel Issue System

| Channel | Purpose |
|---------|---------|
| nezha DB | Task tracking, AI collaboration |
| GitHub | Discussions, @mentions, human visible |

### Creating GitHub Issues

```bash
# Via nezha reflection (auto-syncs high priority)
node ./node_modules/.bin/nezha areflect "[ISSUE] title: ... severity:high"

# Via GitHub CLI
gh issue create --repo emptist/nezha --title "Title" --body "Body"
```
