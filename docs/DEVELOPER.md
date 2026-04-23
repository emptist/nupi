# NuPI Developer Guide

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Pi (TUI)                  │
│  - Dialog interface                         │
│  - Tool execution (bash, read, edit, write) │
│  - Skill loading                            │
└──────────────────┬──────────────────────────┘
                   │ Local calls
                   ▼
┌─────────────────────────────────────────────┐
│              PostgreSQL                     │
│  ┌─────────┬──────────┬──────────┐         │
│  │  tasks  │ memory   │ issues   │ ...     │
│  └─────────┴──────────┴──────────┘         │
└─────────────────────────────────────────────┘
```

## Core Components

### 1. Pi Extension (`src/extension.ts`)

- **Hooks**: session_start, tool_result, before_agent_start, turn_end
- **Thinker slot**: registerThinker/unregisterThinker for delegation mode
- **Tools**: nupi-think, nupi-tasks, nupi-autonomous

### 2. Skills (`skills/`)

- **nupi-abc.md**: AI required reading

### 3. Database Tables

Key tables:

| Table                | Purpose        |
| ------------------- | -------------- |
| tasks               | Task queue     |
| issues              | Issue tracking |
| memory              | Long-term memory |
| reviews             | Code reviews   |
| table_documentation | AI tool index  |

## Development

```bash
# Enter directory
cd ~/gits/hub/tools_ai/nupi

# Build
npm run build

# Type check
npm run typecheck
```

## Thinker Slot API

```typescript
import { registerThinker, unregisterThinker } from "@nezha/nupi";
import type { ExternalThinker } from "@nezha/nupi";

const myThinker: ExternalThinker = {
  async think(question: string): Promise<string> {
    return await callStrongModel(question);
  }
};

registerThinker(myThinker);   // NuPI enters delegating mode
unregisterThinker();          // NuPI returns to self-sufficient mode
```

## Publishing

```bash
cd nupi
npm publish --access public
```

Install:

```bash
npm install @nezha/nupi
```
