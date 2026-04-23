# NuPI (牛派)

> NuPI = Pi + Nezha (via CLI hooks)

## Philosophy

**NuPI is Pi with Nezha hooks.** No HTTP, no MCP, no direct database import. Uses Pi extension hooks + nezha CLI commands.

## Architecture

```
NuPI = Pi (agent loop) + NuPI Extension (hooks)
                    │
                    └── Hooks: session_start → task-add
                             tool_result (error) → issue-add
                             before_agent_start → system prompt injection
                             turn_end → commit/docs reminders
```

## Modes

NuPI derives its mode from the **thinker slot** — no boolean flag needed:

| Mode                 | Condition | Behavior                                         |
| -------------------- | --------- | ------------------------------------------------ |
| **Self-sufficient**  | No thinker registered | AI handles thinking itself (no auto-delegation) |
| **External Thinker** | Thinker registered via `registerThinker()` | Auto-delegates complex tasks to external thinker |

The plug IS the mode. You cannot be in delegating mode without a thinker, and you cannot have a thinker without being in delegating mode.

### How Modes Are Set

- **CLI standalone** (`nupi` command): No thinker registered — self-sufficient by default
- **Embedded in Piano**: Piano calls `registerThinker(thinker)` to plug in its thinking capability

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NUPI_VERBOSE` | When `'true'`, enables verbose logging |

## Thinker Slot API

```typescript
import { nupiExtension, registerThinker, unregisterThinker } from "@nezha/nupi";
import type { ExternalThinker } from "@nezha/nupi";

// Define a thinker
const myThinker: ExternalThinker = {
  async think(question: string): Promise<string> {
    // Call your strong model here
    return await callOpenCode(question);
  }
};

// Plug it in — NuPI is now in delegating mode
registerThinker(myThinker);

// Unplug — NuPI returns to self-sufficient mode
unregisterThinker();
```

## What NuPI Does

- **Hooks**: Bridges Pi events to nezha CLI commands
- **System Prompt**: Tells AI about available nezha tools + mode
- **Reminders**: Every 5 turns → commit reminder; after 10+ file edits → docs reminder
- **External Thinker**: When a thinker is registered, provides `nupi-think` tool for delegation

## How It Works

```
Pi Session Start → NuPI Hook → nezha task-add "Session Started"
Tool Failure → NuPI Hook → nezha issue-add "Tool Failed: X"
Before Agent Start → NuPI Hook → Injects nezha tool awareness
Turn End (5 turns) → NuPI Hook → Commit reminder
Turn End (10+ files) → NuPI Hook → Docs reminder
```

## Usage

```bash
# Install globally
npm install -g @nezha/nupi

# Run pi with nupi extension (self-sufficient mode)
nupi
```

## NuPI Hooks

| Pi Event               | Nezha Action            | Purpose                          |
| ---------------------- | ----------------------- | -------------------------------- |
| `session_start`        | `nezha task-add`        | Track sessions automatically     |
| `tool_result` (error)  | `nezha issue-add`       | Capture failures automatically   |
| `before_agent_start`   | System prompt injection | Tell AI about nezha tools + mode |
| `turn_end` (5 turns)   | UI notification         | Commit reminder                  |
| `turn_end` (10+ files) | UI notification         | Docs reminder                    |

## External Thinker Integration

When a thinker is registered (delegating mode):

- Auto-delegates complex tool calls to the external thinker
- NuPI intercepts tool calls and returns delegation response
- For explicit delegation, use `nupi-think` tool — calls `thinker.think(question)` directly

When no thinker is registered (self-sufficient mode):

- All tasks handled locally
- No auto-delegation occurs
- `nupi-think` tool returns "self-sufficient mode" message

## System Prompt (injected to AI)

```
## Nezha Integration
You have access to Nezha coordination layer via NuPI:
- Tasks: 'nezha task-add <title> [desc]' to create tasks
- Issues: 'nezha issue-add <title> [--severity] [--tag]' to create issues
- View: 'nezha tasks' or 'nezha issue-list' to see existing work

💡 Pro tip: You can extend this extension with Pi hooks at ~/.pi/agent/extensions/

## Mode: Self-sufficient or External Thinker
When a thinker is registered, use 'nupi-think' tool to delegate complex reasoning.
```

## CLI Only Design

NuPI communicates with nezha via CLI only - no direct imports:

- ✅ `nezha task-add`, `nezha tasks`, `nezha issue-add`, `nezha issue-list`
- ❌ No `@nezha/nupi` library import in other packages
- ❌ No direct database access

This aligns with "CLI as the new trend for LLMs" - AIs use shell commands naturally.

## Package Info

- **NPM**: `@nezha/nupi`
- **CLI**: `nupi` (launches pi with extension)
- **Dependencies**: None (uses global `nezha` CLI)
- **Peer**: `@mariozechner/pi-coding-agent`

## Install

```bash
npm install -g @nezha/nupi
```

## Not NuPI

- ❌ No HTTP API
- ❌ No MCP server
- ❌ No library import (uses CLI instead)
- ❌ No direct database access
