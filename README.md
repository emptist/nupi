# NuPI (牛派)

> NuPI = Pi + Nezha tools (via NPM import)

## Philosophy

**NuPI is just Pi with Nezha tools.** No HTTP, no MCP, no daemon. Uses Pi SDK + imports Nezha NPM.

## Architecture

```
NuPI = Pi (full agent loop) + @nezha/nupi (NPM tools)
                    │
                    └── Tools: nezha_status, nezha_get_tasks, nezha_create_task, ...
```

## What NuPI Does

- Runs Pi agent loop with full capabilities (tools, skills, memory, compaction)
- Adds Nezha coordination tools as Pi tools
- Uses PostgreSQL via Nezha NPM import (no subprocess)

## Usage

```typescript
import { nupiTools } from "@nezha/nupi";
import { createAgentSession } from "@mariozechner/pi-coding-agent";

const { session } = await createAgentSession({
  customTools: nupiTools,
});
```

## NuPI Tools (available in Pi)

| Tool                | Description                           |
| ------------------- | ------------------------------------- |
| `nezha_status`      | System status (tasks, issues, memory) |
| `nezha_get_tasks`   | Get pending tasks                     |
| `nezha_create_task` | Create new task                       |

## Install

```bash
npm install @nezha/nupi
```

## Not NuPI

- ❌ No HTTP API to Nezha
- ❌ No MCP server
- ❌ No daemon
- ❌ No subprocess (uses NPM import instead)

## Package Info

- **NPM**: `@nezha/nupi`
- **Dependencies**: `nezha`, `@mariozechner/pi-coding-agent`
