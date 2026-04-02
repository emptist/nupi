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

| Command | Description |
|---------|-------------|
| `nupi-tasks` | List pending tasks |
| `nupi-issues` | List open issues |
| `nupi-status` | System status |
| `nupi-work` | Autonomous work mode |
| `nupi-learn` | Save learning |
| `nupi-search` | Search memory |

---

## Commands

```bash
npm run typecheck  # Type check
npm run build      # Build
npm run test      # Tests
```

### Using nezha CLI

```bash
# View tasks
node ./node_modules/.bin/nezha tasks

# View issues
node ./node_modules/.bin/nezha issues list

# Share message
node ./node_modules/.bin/nezha share "message"

# Create issue/task
node ./node_modules/.bin/nezha areflect "[ISSUE] title: ..."
```

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
