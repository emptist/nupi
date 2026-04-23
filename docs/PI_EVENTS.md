# Pi Coding Agent Hooks/Events Reference

> See issue #f363bbcc for skill system integration

## All Available Events

### Session Events
- `session_start` - Session started
- `session_shutdown` - Session ending
- `session_before_switch` - Before switching sessions
- `session_before_fork` - Before forking session
- `session_before_compact` - Before session compact
- `session_compact` - Session compact
- `session_before_tree` - Before tree view
- `session_tree` - Tree view

### Agent Events
- `agent_start` - Agent starting
- `agent_end` - Agent finished
- `before_agent_start` - Before agent starts (use for system prompt injection)

### Turn/Message Events
- `turn_start` - Turn started
- `turn_end` - Turn finished
- `message_start` - Message started
- `message_update` - Message updated
- `message_end` - Message finished

### Tool Events
- `tool_call` - Tool being called (use for auto-delegation)
- `tool_result` - Tool result returned
- `tool_execution_start` - Tool execution starting
- `tool_execution_update` - Tool execution progress
- `tool_execution_end` - Tool execution finished

### Other Events
- `input` - User input received (intercept before agent processes)
- `user_bash` - User bash command
- `context` - Context building
- `resources_discover` - Resource discovery
- `model_select` - Model selection
- `before_provider_request` - Before provider request

## Usage Example

```typescript
pi.on("input", async (event: InputEvent) => {
  if (delegation.mode === "delegating") {
    console.log(`[NuPI] User input received, delegating to thinker`);
    return {
      action: "transform",
      text: `Delegate this to external thinker: ${event.text}`
    };
  }
  return { action: "continue" };
});
```

## InputEvent Details

```typescript
interface InputEvent {
  type: "input";
  text: string;           // The input text
  images?: ImageContent[]; // Attached images
  source: InputSource;    // "interactive" | "rpc" | "extension"
}

type InputEventResult = 
  | { action: "continue" }                    // Normal processing
  | { action: "transform"; text: string }    // Modify and continue
  | { action: "handled" };                    // We handle, agent doesn't process
```