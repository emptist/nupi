# NuPI Developer Guide

## Identity

**I am NuPI AI**, not nezha!

| Project | Responsibility |
|---------|---------------|
| NuPI | Independent AI, uses Pi + local LLM |
| Nezha | Database service + CLI |
| Piano | NuPI + OpenCode (task routing) |

---

## Architecture

```
NuPI ←CLI→ Nezha (PostgreSQL)
```

- **NuPI**: Execution layer, Pi + local LLM (Ollama)
- **Nezha**: Service layer, CLI + DB + tasks/memory/broadcast

### Thinker Slot

NuPI uses a thinker slot pattern for delegation:

```typescript
import { nupiExtension, registerThinker, unregisterThinker } from "@nezha/nupi";
import type { ExternalThinker } from "@nezha/nupi";

const myThinker: ExternalThinker = {
  async think(question: string): Promise<string> {
    return await callStrongModel(question);
  }
};

registerThinker(myThinker);   // NuPI enters delegating mode
unregisterThinker();          // NuPI returns to self-sufficient mode
```

The mode is derived from the thinker slot — no boolean flag needed.

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL (nezha database)
- Pi (TUI)

### Setup

```bash
npm install
npm run build
```

### Development Workflow

1. Modify code
2. `npm run typecheck`
3. `npm run build`
4. Commit (include task ID)
5. Push to remote

---

## Using nezha CLI

NuPI uses the nezha CLI directly:

```bash
# View tasks
nezha tasks

# View issues
nezha issue-list

# Broadcast
nezha share "message"

# Learn - save learning/create issue/task
nezha learn "[LEARN] insight: ..."
nezha issue-add "Bug found" --severity high
nezha task-add "Implement feature X" --priority 8

# Check pending
nezha tasks --status PENDING
```

---

## Pi Extensions

### Correct Installation

**Don't manually copy files to `~/.pi/agent/extensions/`**!

Use `pi install`:

```bash
# 1. Add config in package.json
# {
#   "pi": {
#     "extensions": ["./extensions/nupi-tools.ts"]
#   }
# }

# 2. Install
pi install ./

# 3. Verify
pi list
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/extension.ts` | Pi extension hooks + thinker slot |
| `src/index.ts` | Public API exports |
| `bin/nupi.ts` | CLI entry point |

---

## Commands

```bash
npm run typecheck  # Type check
npm run build      # Build
```

---

## Cross-AI Collaboration

Collaborate via shared database:

```bash
# Broadcast
nezha share "message"

# Create issue/task
nezha issue-add "Bug found" --severity high

# Save learning
nezha learn "[LEARN] insight: ..."
```

---

## Troubleshooting

### Database Connection

```bash
psql -U postgres -d nezha -c "SELECT 1;"
```

Environment variables:
```bash
NEZHA_DB_HOST=localhost
NEZHA_DB_PORT=5432
NEZHA_DB_NAME=nezha
```

---

## Important Notes

1. **NuPI is independent** - doesn't need OpenCode or MCP
2. **CLI only** - uses nezha CLI for all persistence
3. **Thinker slot** - delegation mode is derived from thinker registration, not a boolean flag
4. **No HTTP API** - NuPI communicates with Nezha via CLI only
