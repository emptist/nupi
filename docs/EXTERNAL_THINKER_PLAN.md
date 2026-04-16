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
            │ CLI/API                               │ delegating
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

## Current State

| Component | Role | Status |
|-----------|------|--------|
| **Pi** | Weak local agent | ✅ Works |
| **NuPI** | Pi extension with nezha hooks | ✅ Works |
| **Nezha** | Persistence layer (CLI + DB) | ✅ Works |
| **Piano** | Thinking router | ⚠️ `piano_think` is placeholder only |
| **OpenCode** | Strong external thinker | ❓ Not integrated |

### The Gap

**Piano's `piano_think` tool currently returns:**
```typescript
async execute(_id: any, params: any) {
  return {
    content: [{ type: "text", text: `[Piano→OpenCode] Thinking: ${params.question}` }],
    details: { action: "route_to_opencode" },
  };
}
```

This is a placeholder - it doesn't actually call OpenCode.

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

## Phase 1: Define Delegation Protocol

### Options for Calling OpenCode

| Approach | How | Pros | Cons |
|----------|-----|------|------|
| **A. CLI** | `opencode --prompt "..." --json` | Simple, same pattern as nezha | OpenCode may not have CLI mode |
| **B. HTTP API** | `POST http://localhost:5999/api/think` | Fast, structured | Requires OpenCode server running |
| **C. File-based** | Write task to file, wait for result | Decoupled, works offline | Slower, needs polling |
| **D. Task Queue** | Create nezha task, wait for external agent | Works across machines | Complex, needs coordination |

**Recommended**: Start with **A (CLI)** or **B (HTTP API)**.

### Investigation Needed

```bash
# Check if OpenCode supports non-interactive mode
opencode --help | grep -E "non-interactive|prompt|json|api"

# Or check for HTTP API
curl http://localhost:5999/health 2>/dev/null
```

---

## Phase 2: Implement `piano_think` Properly

### Location: `piano/src/extension.ts`

```typescript
import { execSync } from "child_process";
import { Type } from "@sinclair/typebox";

const pianoThinkTool = {
  name: "piano_think",
  label: "Piano Think",
  description: "Delegate complex reasoning to external agent (OpenCode)",
  parameters: Type.Object({
    context: Type.String({ description: "Current situation and what's been tried" }),
    question: Type.String({ description: "What needs deep analysis" }),
    timeout: Type.Optional(Type.Number({ description: "Max wait time in seconds", default: 300 })),
  }),
  async execute(_id: any, params: any) {
    const { context, question, timeout = 300 } = params;
    
    // Try CLI approach first
    const result = await delegateThink(context, question, timeout);
    
    return {
      content: [{ type: "text", text: result }],
      details: { source: "opencode" },
    };
  },
};

async function delegateThink(
  context: string, 
  question: string, 
  timeout: number
): Promise<string> {
  // Option A: CLI approach
  const prompt = `Context:\n${context}\n\nQuestion: ${question}\n\nProvide a detailed answer.`;
  
  try {
    const result = execSync(`opencode --print "${prompt}"`, {
      encoding: "utf-8",
      timeout: timeout * 1000,
      maxBuffer: 1024 * 1024,  // 1MB buffer
    });
    return result;
  } catch (error) {
    // Fallback: Try HTTP API
    try {
      return await delegateViaHTTP(context, question, timeout);
    } catch (httpError) {
      return `[Delegation failed]\n\nCLI error: ${error.message}\nHTTP error: ${httpError.message}\n\nConsider continuing with available context.`;
    }
  }
}

async function delegateViaHTTP(
  context: string, 
  question: string, 
  timeout: number
): Promise<string> {
  const response = await fetch("http://localhost:5999/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` }
      ],
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(timeout * 1000),
  });
  
  const data = await response.json();
  return data.content || data.message || JSON.stringify(data);
}
```

---

## Phase 3: NuPI Auto-Delegation Mode (Optional)

### Location: `nupi/src/extension.ts`

Add **opt-in weak model mode** that auto-delegates when stuck:

```typescript
// Configuration
const AUTO_DELEGATE = process.env.NUPI_AUTO_DELEGATE === "true";
const WEAK_MODEL_INDICATORS = [
  "I cannot",
  "I'm not sure how to",
  "This is beyond my",
  "I need help with",
  "I don't have access to",
  "requires a stronger model",
];

export default function nupiExtension(pi: ExtensionAPI) {
  // Existing hooks...
  pi.on("before_agent_start", async () => ({ systemPrompt: NEZHA_PROMPT }));
  pi.on("session_start", ...);
  pi.on("tool_result", ...);
  
  // NEW: Auto-delegation for weak models (opt-in)
  if (AUTO_DELEGATE) {
    pi.on("assistant_message", async (event) => {
      const content = event.content || "";
      
      if (WEAK_MODEL_INDICATORS.some(ind => content.includes(ind))) {
        // Extract task context from recent messages
        const context = await getLastTaskFromNezha();
        
        pi.sendUserMessage(
          `[Auto-delegating to external thinker]\n\n` +
          `Context: ${context}\n` +
          `Weak response detected. Use piano_think for complex reasoning.`
        , { deliverAs: "steer" });
      }
    });
  }
}

async function getLastTaskFromNezha(): Promise<string> {
  try {
    const result = execSync("nezha tasks --status PENDING --json", { encoding: "utf-8" });
    const tasks = JSON.parse(result);
    return tasks[0]?.title || "No pending task";
  } catch {
    return "Unknown task context";
  }
}
```

---

## Phase 4: Task Continuation Pattern

When OpenCode completes thinking, results should flow back:

```typescript
// In piano_think result handling
async function handleThinkResult(result: string, pi: ExtensionAPI) {
  // 1. Create issue with result for traceability
  await execNezha([
    "issue-add", 
    `[Delegated Thinking Result]`, 
    `--tag delegated`,
    `--description`, result.substring(0, 500)
  ]);
  
  // 2. Send result back to Pi (if possible)
  // Note: This requires reference to pi, may need different approach
  // pi.sendUserMessage(`[External Thinker Result]\n${result}\n\nContinue with next task.`);
  
  // 3. Result is returned to the tool caller and visible in conversation
}
```

---

## Configuration

### NuPI Config (`~/.config/nupi/config.yaml`)

```yaml
delegation:
  enabled: true
  endpoint: "cli"  # or "http://localhost:5999"
  timeout: 300
  fallback: "continue"  # or "abort" if delegation fails

weak_model:
  auto_delegate: true
  indicators:
    - "I cannot"
    - "I'm not sure how to"
    - "This is beyond my"
```

### Environment Variables

```bash
# Enable auto-delegation
NUPI_AUTO_DELEGATE=true

# Delegation endpoint
PIANO_DELEGATE_ENDPOINT=http://localhost:5999

# Timeout in seconds
PIANO_DELEGATE_TIMEOUT=300
```

---

## Implementation Steps

### Step 1: Verify OpenCode Capabilities

```bash
# Check OpenCode CLI options
cd ../refers/opencode
npm run build
./dist/cli.js --help

# Or check for server mode
grep -r "server\|api\|http" packages/*/src/
```

### Step 2: Implement in Piano

```bash
cd ../piano
# Edit src/extension.ts
# Implement actual delegation logic
npm run build
```

### Step 3: Test Delegation Flow

1. Start Pi with weak model
2. Run complex task
3. Call `piano_think`
4. Verify OpenCode response
5. Continue with result

### Step 4: Add Auto-Delegation (Optional)

```bash
cd ../nupi
# Edit src/extension.ts
# Add weak model detection and auto-delegation
npm run build
```

---

## Key Files to Modify

| File | Change |
|------|--------|
| `piano/src/extension.ts` | Implement real `piano_think` delegation |
| `nupi/src/extension.ts` | Add auto-delegation detection (optional) |
| `piano/package.json` | Add any needed dependencies for HTTP calls |

---

## Testing Checklist

- [ ] OpenCode CLI non-interactive mode works
- [ ] `piano_think` returns OpenCode response
- [ ] Task context passed correctly
- [ ] Timeout handling works
- [ ] Fallback when delegation fails
- [ ] Result stored in nezha (issue)
- [ ] Pi continues after delegation

---

## Future Considerations

1. **Cost tracking**: Log delegated tokens/costs to nezha
2. **Smart routing**: Only delegate when needed (complexity detection)
3. **Batch delegation**: Queue multiple think requests
4. **Result caching**: Store common patterns in nezha memory
5. **Multi-agent**: Support multiple external thinkers

---

## References

- Pi Extension API: `../refers/pi-mono/packages/coding-agent/dist/core/extensions/types.d.ts`
- OpenCode: `../refers/opencode/`
- Piano: `../piano/src/extension.ts`
- NuPI: `./src/extension.ts`
- Nezha CLI: `../nezha/src/cli/`