# External Thinker Mode Implementation Plan

> Plan for implementing delegation of complex thinking from weak models (Pi/NuPI) to strong models (OpenCode/Piano).

## Background

NuPI running on Pi may only have weak models available. When complex thinking is needed, it should delegate to external agents (like Piano routing to OpenCode) and get results back.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           External Agent Layer                          │
│  ┌─────────────────┐                    ┌─────────────────┐            │
│  │    OpenCode     │ ←── Strong model ──│     Piano       │            │
│  │  (Full coding   │     for thinking   │ (Thinking       │            │
│  │   agent)        │                    │  Router)        │            │
│  └────────┬────────┘                    └────────┬────────┘            │
│           │                                      │                      │
└───────────┼──────────────────────────────────────┼──────────────────────┘
            │                                      │
            │ CLI/API                               │ registerThinker()
            │                                      │
└───────────┼──────────────────────────────────────┼──────────────────────┐
│           │              Local Agent             │                      │
│  ┌────────┴────────┐                    ┌────────┴────────┐            │
│  │      NuPI       │ ←─ Extension ───→ │      Pi          │            │
│  │  (Extension     │     hooks          │  (Weak model     │            │
│  │   + CLI)        │                    │   TUI agent)     │            │
│  └────────┬────────┘                    └─────────────────┘            │
│           │                                                           │
└───────────┼───────────────────────────────────────────────────────────┘
            │
            │ CLI (nezha task-add, nezha issue-add, etc.)
            │
┌───────────┴───────────────────────────────────────────────────────────┐
│                    Persistence Layer                                  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    nezha (CLI + PostgreSQL)                     │  │
│  │   Tasks │ Issues │ Meetings │ Memory                            │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

## Package Locations

| Package | Repo Path | NPM Name | Role |
|---------|-----------|----------|------|
| Pi | `../refers/pi-mono/packages/coding-agent/` | `@mariozechner/pi-coding-agent` | Local agent (TUI) |
| NuPI | `./` (this repo) | `@nezha/nupi` | Pi extension with nezha hooks |
| Nezha | `../nezha/` | `nezha` | Persistence layer (CLI + PostgreSQL) |
| Piano | `../piano/` | `@nezha/piano` | Thinking router |
| OpenCode | `../refers/opencode/` | `opencode-ai` | External strong model agent |

## Thinker Slot Design

NuPI uses a **thinker slot** pattern instead of a boolean flag. The mode is derived from whether a thinker is registered:

| Mode | Condition | Behavior |
|------|-----------|----------|
| Self-sufficient (default) | No thinker registered | Handles all tasks locally without delegation |
| Delegating | Thinker registered via `registerThinker()` | Auto-delegates complex tasks to external thinker |

### Why This Design

The previous `delegateMode` boolean had critical bugs:
- Inverted logic (bug #1d45fcd0): `delegateMode=false` meant "delegate everything"
- Could be in delegating mode without a thinker (no callback set)
- Could have a thinker set but not be in delegating mode

The thinker slot eliminates these by construction:
- You cannot be in delegating mode without a thinker (it's in the type)
- You cannot have a thinker without being in delegating mode (registering IS the mode switch)
- The discriminated union makes invalid states unrepresentable

### ExternalThinker Interface

```typescript
export interface ExternalThinker {
  think(question: string): Promise<string>;
}

type DelegationMode =
  | { mode: "self-sufficient" }
  | { mode: "delegating"; thinker: ExternalThinker };
```

### Consumer API (Piano)

```typescript
import { registerThinker, unregisterThinker } from "@nezha/nupi";
import type { ExternalThinker } from "@nezha/nupi";

const pianoThinker: ExternalThinker = {
  async think(question: string): Promise<string> {
    // Route to OpenCode or other strong model
    return await routeToOpenCode(question);
  }
};

// Plug in — NuPI enters delegating mode
registerThinker(pianoThinker);

// Unplug — NuPI returns to self-sufficient mode
unregisterThinker();
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NUPI_VERBOSE` | (not set) | When `'true'`, enables verbose logging |

## Current State

| Component | Role | Status |
|-----------|------|--------|
| **Pi** | Weak local agent | ✅ Works |
| **NuPI** | Pi extension with nezha hooks + thinker slot | ✅ Works |
| **Nezha** | Persistence layer (CLI + DB) | ✅ Works |
| **Piano** | Thinking router | ⚠️ Needs to implement `ExternalThinker` interface |
| **OpenCode** | Strong external thinker | ❓ Not integrated |

### The Gap

**Piano needs to implement the `ExternalThinker` interface and register it with NuPI:**

```typescript
// In Piano's initialization
import { registerThinker } from "@nezha/nupi";

const opencodeThinker: ExternalThinker = {
  async think(question: string): Promise<string> {
    const result = execSync(`opencode --print "${question}"`, {
      encoding: "utf-8",
      timeout: 300000,
    });
    return result;
  }
};

registerThinker(opencodeThinker);
```

## Pi Extension API (Key Methods)

```typescript
// Available hooks
pi.on("before_agent_start", async (event) => {
  return { systemPrompt: "..." };  // Inject system prompt
});

pi.on("session_start", async (event) => {
  // Called when session starts
  // event.reason: string
});

pi.on("tool_result", async (event) => {
  // Called after tool execution
  // event.toolName, event.isError, event.result
});

// Available actions
pi.sendUserMessage(content, options?: { deliverAs: "steer" | "followUp" });
pi.registerTool(toolDefinition);
pi.registerCommand(name, { description, handler });
```

---

## Phase 1: Piano Implements ExternalThinker

### Location: `piano/src/extension.ts`

```typescript
import { registerThinker, unregisterThinker } from "@nezha/nupi";
import type { ExternalThinker } from "@nezha/nupi";
import { execSync } from "child_process";

const opencodeThinker: ExternalThinker = {
  async think(question: string): Promise<string> {
    try {
      const result = execSync(`opencode --print "${question}"`, {
        encoding: "utf-8",
        timeout: 300000,
        maxBuffer: 1024 * 1024,
      });
      return result;
    } catch (error) {
      throw new Error(`OpenCode delegation failed: ${error.message}`);
    }
  }
};

// Register on startup
registerThinker(opencodeThinker);

// Unregister on shutdown
process.on("exit", () => unregisterThinker());
```

---

## Phase 2: Test Delegation Flow

1. Start Pi with weak model
2. Piano registers its thinker with NuPI
3. Run complex task
4. Call `nupi-think` → thinker.think() → OpenCode response
5. Verify response flows back
6. Test auto-delegation of complex tool calls

---

## Phase 3: Error Handling & Resilience

When the external thinker fails, NuPI returns an error message:

```typescript
// Already implemented in nupi-think tool
try {
  const result = await delegation.thinker.think(params.question);
  return { content: [{ type: "text", text: result }], details: { delegated: true } };
} catch (e) {
  return { content: [{ type: "text", text: `External thinker failed: ${e}` }], details: { error: true } };
}
```

---

## Key Files

| File | Change |
|------|--------|
| `nupi/src/extension.ts` | ✅ Thinker slot implemented |
| `nupi/src/index.ts` | ✅ Exports registerThinker, unregisterThinker, ExternalThinker |
| `piano/src/extension.ts` | 🔲 Implement ExternalThinker interface and register |

---

## Testing Checklist

- [ ] Piano implements `ExternalThinker` interface
- [ ] Piano calls `registerThinker()` on startup
- [ ] `nupi-think` tool calls `thinker.think()` and returns result
- [ ] Auto-delegation works when thinker is registered
- [ ] Self-sufficient mode works when no thinker is registered
- [ ] Error handling when thinker.think() throws
- [ ] `unregisterThinker()` returns to self-sufficient mode

---

## Future Considerations

1. **Cost tracking**: Log delegated tokens/costs to nezha
2. **Smart routing**: Only delegate when needed (complexity detection)
3. **Batch delegation**: Queue multiple think requests
4. **Result caching**: Store common patterns in nezha memory
5. **Multi-agent**: Support multiple external thinkers via named slots

---

## References

- Pi Extension API: `../refers/pi-mono/packages/coding-agent/dist/core/extensions/types.d.ts`
- OpenCode: `../refers/opencode/`
- Piano: `../piano/src/extension.ts`
- NuPI: `./src/extension.ts`
- Nezha CLI: `../nezha/src/cli/`
