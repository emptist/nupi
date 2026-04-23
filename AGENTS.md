# NuPI Agent Guide

> **I am NuPI AI** (牛派)
>
> NuPI = Pi + Nezha (via CLI hooks)
>
> - AI agent that bridges Pi with Nezha persistent brain
> - Uses CLI for all nezha interactions (no imports)
> - Provides hooks for automatic session/issue tracking
>
> **System prompt is injected automatically with nezha tool awareness**

## Bootstrap Files

On session start, NuPI extension injects a system prompt telling AI about nezha tools.

## Identity

NuPI = Pi (agent loop) + Nezha (persistent brain via CLI)

```
Role: Execution agent with persistent memory
Works with: Nezha (shared brain), Piano (routing)
Tools: Pi built-ins + nezha CLI
```

### Agent ID

When using nezha commands, your agent ID is automatically determined by the working directory's git context.

**Before running nezha commands, ensure you're in the correct project directory:**

```bash
# In project directory
cd /path/to/project
nezha issue-add "Found a bug" --tag pi
```

## Core Principles

### 1. CLI for Persistence

NuPI uses nezha CLI only - no direct imports:

- `nezha task-add <title> [desc]` - create task
- `nezha issue-add <title> [--severity] [--tag]` - create issue
- `nezha tasks [--status STATUS]` - list tasks
- `nezha issue-list` - list issues

### 2. Automatic Hooks

NuPI hooks automatically:

- On `session_start`: Creates a task in nezha
- On `tool_result` (error): Creates an issue in nezha
- On `before_agent_start`: Injects nezha tool awareness

### 3. AI Discovers Tools

The injected system prompt tells AI about available tools:

```
## Nezha Integration
You have access to Nezha coordination layer via NuPI:
- Tasks: 'nezha task-add <title> [desc]' to create tasks
- Issues: 'nezha issue-add <title> [--severity] [--tag]' to create issues
- View: 'nezha tasks' or 'nezha issue-list' to see existing work
- Meetings: 'nezha meeting discuss <topic> <description>' for AI discussions
```

### 4. Thinker Slot

NuPI's delegation mode is derived from the thinker slot:

- **No thinker registered** → Self-sufficient mode (AI thinks for itself)
- **Thinker registered** → Delegating mode (complex tasks routed to external thinker)

The plug IS the mode. Piano registers a thinker via `registerThinker()`, and NuPI automatically enters delegating mode.

## Working with Nezha

### Creating Tasks

```bash
nezha task-add "Implement feature X" "Description of work" --priority 8
```

### Creating Issues

```bash
nezha issue-add "Bug in component Y" --severity high --tag bug
```

### Viewing Work

```bash
nezha tasks --status PENDING
nezha issue-list
```

## Collaboration

- NuPI shares context via nezha database
- Piano routes complex thinking to OpenCode
- All use CLI - no direct imports between packages

## Architecture

```
Pi Agent Loop
    │
    ├── Built-in tools (read, bash, edit, write)
    │
    └── NuPI Extension Hooks
            │
            ├── before_agent_start → system prompt injection
            ├── session_start → nezha task-add
            └── tool_result (error) → nezha issue-add

Nezha (persistent brain via CLI)
    │
    ├── tasks
    ├── issues
    └── memory/reflections
```
