# The Piano → NuPI → Nezha Delegation Chain: Design Considerations

## 1. The Three-Layer Architecture

The system is built on a **three-metal alloy** metaphor:

| Layer             | Component | Metal                                | Role                                                   |
| ----------------- | --------- | ------------------------------------ | ------------------------------------------------------ |
| **Service**       | Nezha     | Base metal                           | PostgreSQL + tasks + memory + broadcasts + issues      |
| **Execution**     | NuPI      | Alloy (Pi + Nezha)                   | Local AI worker with code tools (read/edit/write/bash) |
| **Orchestration** | Piano     | Triple alloy (OpenCode + Pi + Nezha) | Task routing + OpenCode as "engine"                    |

## 2. The Two Work Modes

From `nupi/docs/DUAL_WORK_MODE.md`:

- **Standalone Mode** (`NuPI = bicycle`): NuPI works autonomously with its local model (`glm-4.5-flash`), using Pi's tools and Nezha's database. No external AI needed.
- **External Mode** (`Piano = motorcycle`): OpenCode acts as the "engine" for heavy reasoning. Piano routes complex tasks to OpenCode, while NuPI handles local operations.

Key design principle: **"谁需要委托层，谁去实现"** — whoever needs the delegation layer should implement it.

## 3. The Delegation Decision Logic

There are **three separate delegation decision points** in the codebase, each with different logic:

### A. NuPI's `shouldUseExternal()` — `nupi/src/index.ts`

```typescript
export function shouldUseExternal(task: string): boolean {
  if (process.env.NUPI_FORCE_LOCAL === "true") return false;
  return !isLocalTask(task);
}
```

This is the **broadest** gate — it delegates **everything** except a tiny whitelist (`pwd`, `echo`, `whoami`, `date`). The consideration: if OpenCode is available, use it for almost everything because its model is stronger. The `NUPI_FORCE_LOCAL` env var provides an escape hatch.

### B. Piano's `TaskRouter` — `piano/src/router/TaskRouter.ts`

Uses a **keyword-based routing** system with a capability hierarchy:

```
pi (level 1) < internal (level 2) < opencode (level 3) < human (level 4)
```

Routing logic:

1. **Explicit delegation** → honor it
2. **High priority (≥50)** → always OpenCode
3. **Simple Pi tasks** (remind/check/plan/simple/review/list) → Pi
4. **Requires OpenCode** (edit file/modify code/run bash/database/implement/create/build/refactor) → OpenCode
5. **Default** → OpenCode (when available)
6. **Fallback** → Pi or internal

**Design flaw** (identified in role-reversal doc): Pi is incorrectly relegated to "simple text tasks" when it actually has powerful code tools (read/edit/write/bash). The keyword matching is too crude.

### C. Piano's `TaskPlanner` — `piano/src/planner/TaskPlanner.ts`

Adds a **complexity-based** delegation check:

```typescript
const shouldDelegate = needsDelegation(complexity, selfCapability);
// complexity >= 5 → needs level 3 (opencode)
// complexity >= 3 → needs level 2 (internal)
// else → level 1 (pi)
```

Complexity is estimated by keyword counting (refactor/debug/security = +1, test/integration/fix = +0.5). More nuanced than TaskRouter's keyword matching.

## 4. The Two Delegation Paths

There are **two completely separate code paths** for delegating to OpenCode:

### Path 1: Piano's `TaskCoordinator` → `OpenCodeSessionManager` (Piano-driven)

Used by `PianoHeartbeatService` and `ContinuousWorkEngine`:

```
TaskRouter.route() → TaskCoordinator.execute() → OpenCodeSessionManager
  1. Create session (POST /session)
  2. Send message (POST /session/:id/message) — streaming
  3. Poll for completion (GET /session/status) — checks additions/deletions/files
  4. Verify real changes (idle detection + code change verification)
```

Key consideration: `waitForCompletion()` has a **fake completion detector** — it checks if `additions > 0 || deletions > 0` and throws an error if the AI claims done but made no actual code changes. Defense against AI "declaring done" without doing real work.

### Path 2: NuPI's CLI Approach (NuPI-driven) - DEPRECATED

> **IMPORTANT (2026-04-14)**: ExternalDelegate has been removed!
> NuPI now uses CLI: `exec('nezha tasks')` instead of HTTP delegation.

The old ExternalDelegate approach that tried to parse streaming response as JSON is now deleted.

## 5. The ExternalAgentServer — Piano's Approach

`piano/src/services/ExternalAgentServer.ts` exposes OpenCode as an HTTP agent server with named agents (scout/planner/worker). It:

- Registers agents with system prompts
- Creates a persistent OpenCode session
- Forwards requests to OpenCode's `/session/:id/message`
- Returns structured `ExternalAgentResponse` with usage stats

Designed for the **Pi subagent chain pattern** (scout → planner → worker) from DUAL_WORK_MODE, but has the same streaming response problem — fires the message and immediately returns without waiting for completion.

## 6. The Nezha Role — The Backbone

Nezha serves as the **shared backbone** for both Piano and NuPI:

- **PostgreSQL database**: Single source of truth for tasks, issues, memory, broadcasts
- **CLI**: NuPI/Piano use `exec('nezha tasks')` instead of HTTP API
- **HeartbeatService**: Base class that Piano extends with routing logic
- **OpenCodeReminderService**: Periodically sends status summaries to OpenCode, nudging it to take action on pending tasks/issues — the "secretary" pattern
- **Scheduler**: Core task scheduling with retry, stuck-task detection, and event bus

Design consideration: Nezha is **independent** — it doesn't need OpenCode. Its core functionality (task management, memory, scheduling) works with its own internal AI provider. OpenCode is an optional integration layer.

## 7. The Auto-Work Extensions — The Glue

Both Piano and NuPI have Pi extensions that form the runtime glue:

### nupi-autowork.ts

> **IMPORTANT (2026-04-14)**: Now uses CLI instead of HTTP!

- On session start: checks Nezha via `exec('nezha status')`
- Periodic work check (every 2 min): fetches pending tasks via `exec('nezha tasks')`
- For each work item: processes locally, never delegates to OpenCode directly
- Registers Pi commands: `nupi-tasks`, `nupi-learn`, `nupi-reflect`
- **Tool parameter normalization**: Intercepts `tool_call` events to fix common parameter mistakes

### piano-autowork.ts

- On session start: ensures OpenCode is running (starts it if needed), waits for Nezha API
- Auto-delegates work to Nezha by creating tasks via API
- If Nezha is down: creates a critical issue (recursive self-healing)
- Registers Pi commands: `piano-start`, `piano-tasks`

## 8. Key Design Considerations

1. **Capability hierarchy as delegation principle**: The system treats AI capability as a ladder (pi < internal < opencode < human). Tasks should flow upward to the minimum capable executor.

2. **"Never declare done" philosophy**: Both HeartbeatService and OpenCodeReminderService embed the principle that AI should always find more work. The fake completion detector in TaskCoordinator enforces this programmatically.

3. **Self-healing through issues**: When Nezha API is down, Piano creates a critical issue — expecting NuPI to pick it up and restart Nezha. This is a recursive self-repair pattern.

4. **Dual delegation is redundant and problematic**: Both Piano (via TaskCoordinator) and NuPI (via ExternalDelegate) can delegate to OpenCode independently. This creates confusion about who owns the delegation responsibility. The role-reversal doc explicitly calls this out.

5. **The streaming vs polling tension**: Piano's path uses polling (`waitForCompletion`), while old ExternalDelegate tried streaming. This was the source of the timeout bug - now fixed by using CLI.

6. **The "motorcycle vs bicycle" metaphor**: This isn't just cute — it's the core product decision. Piano MUST have OpenCode (it's the engine). NuPI doesn't need it (it's self-powered). Users choose which vehicle to ride.

7. **The underutilization problem**: The role-reversal doc identifies that NuPI's extensions (nupi-tools, nupi-autowork) are not leveraged by Piano. Piano treats Pi as a "simple text task" executor when it actually has full code manipulation capabilities through NuPI.

8. **The env var escape hatches**: `NUPI_FORCE_LOCAL`, `NUPI_SELF_MODEL_STRONG`, `NUPI_MODE` — these provide runtime configuration for switching between standalone and external modes without code changes.

## 9. Architecture Rules (2026-04-14)

- **MCP only for OpenCode** - Nezha/NuPI/Piano use CLI instead
- **CLI first**: Use `exec('nezha tasks')` not HTTP
- **NuPI never directly calls OpenCode**: External mode → task queue → Piano → OpenCode

## 10. Removed

- ExternalDelegate class (deleted 2026-04-14) - replaced with CLI calls
