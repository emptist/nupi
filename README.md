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

NuPI supports two working modes controlled by `NUPI_BYSELF` env var:

| Mode                 | NUPI_BYSELF      | Behavior                                         |
| -------------------- | ---------------- | ------------------------------------------------ |
| **Self-sufficient**  | `true` (default) | AI handles thinking itself                       |
| **External Thinker** | `false`          | Delegates complex thinking via `nupi-think` tool |

## What NuPI Does

- **Hooks**: Bridges Pi events to nezha CLI commands
- **System Prompt**: Tells AI about available nezha tools + mode
- **Reminders**: Every 5 turns → commit reminder; after 10+ file edits → docs reminder
- **External Thinker**: When BYSELF=false, provides `nupi-think` tool for delegation

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

# Run with external thinker (for Piano)
NUPI_BYSELF=false nupi
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

When `NUPI_BYSELF=false`, NuPI provides the `nupi-think` tool:

- Delegates complex reasoning to external thinker (e.g., Piano/OpenCode)
- Works with ACP protocol for OpenCode integration
- Simple callback mechanism - external thinker sets `setExternalThinker(callback)`

## System Prompt (injected to AI)

```
## Nezha Integration
You have access to Nezha coordination layer via NuPI:
- Tasks: 'nezha task-add <title> [desc]' to create tasks
- Issues: 'nezha issue-add <title> [--severity] [--tag]' to create issues
- View: 'nezha tasks' or 'nezha issue-list' to see existing work

💡 Pro tip: You can extend this extension with Pi hooks at ~/.pi/agent/extensions/

## Mode: Self-sufficient (BYSELF) or External Thinker (Piano)
Use 'nupi-think' tool to delegate complex reasoning when BYSELF=false
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
