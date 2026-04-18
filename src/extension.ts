import type {
  ExtensionAPI,
  BeforeAgentStartEvent,
  ToolResultEvent,
  TurnEndEvent,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { execSync } from "child_process";

const BYSELF = process.env.NUPI_BYSELF !== "false";

let externalThinkCallback: ((question: string) => Promise<string>) | null =
  null;

let turnCount = 0;
let fileChangeCount = 0;

function execNezha(args: string[]): string | null {
  try {
    return execSync(`nezha ${args.join(" ")}`, {
      encoding: "utf-8",
      timeout: 5000,
    });
  } catch {
    return null;
  }
}

function checkStartupTasks(): string {
  const result = execNezha(["tasks", "--status", "PENDING"]);
  if (!result) return "Could not check tasks";

  if (result.includes("No tasks") || result.trim() === "") {
    return "No pending tasks";
  }

  const lines = result.split("\n").filter((l) => l.match(/^\[\d+\]/));
  if (lines.length === 0) return "No pending tasks";

  const tasks: { priority: number; title: string }[] = [];
  for (const line of lines) {
    const match = line.match(/\[(\d+)\]\s+(.+?)(?:\s+\(\w+\))?$/);
    if (match && match[1]) {
      tasks.push({ priority: parseInt(match[1]), title: match[2] || "" });
    }
  }

  const highPriority = tasks.filter((t) => t.priority >= 8);
  if (highPriority.length > 0) {
    return `🎯 ${highPriority.length} high-priority tasks:\n${highPriority
      .slice(0, 3)
      .map((t) => `- ${t.title.slice(0, 50)}`)
      .join("\n")}`;
  }
  return `📋 ${tasks.length} tasks pending`;
}

const NEZHA_PROMPT = `
## Nezha Integration
You have access to Nezha coordination layer via NuPI:
- Tasks: 'nezha task-add <title> [desc]' to create tasks
- Issues: 'nezha issue-add <title> [--severity] [--tag]' to create issues
- View: 'nezha tasks' or 'nezha issue-list' to see existing work
- Meetings: 'nezha meeting discuss <topic> <description>' for AI discussions

Use these to track progress, create issues for bugs, and collaborate with other AI instances.

## Autonomous Mode
When working autonomously:
1. Use 'nupi-tasks' or 'nezha_get_tasks' to check pending tasks
2. Use 'piano_think' or 'nupi-think' for complex analysis
3. Create issues for problems encountered
4. Log progress via 'nezha learn' for knowledge retention

💡 Pro tip: You can extend this extension with Pi hooks at ~/.pi/agent/extensions/ for custom reminders, automation, or context injection.

## Mode: ${BYSELF ? "Self-sufficient (BYSELF)" : "External Thinker (Piano)"}
${BYSELF ? "You handle thinking yourself." : "Use 'nupi-think' or 'piano_think' tool to delegate complex reasoning to external thinker."}
`.trim();

export function setExternalThinker(
  callback: (question: string) => Promise<string>,
) {
  externalThinkCallback = callback;
}

const nupiThinkTool = {
  name: "nupi-think",
  label: "NuPI Think",
  description:
    "Delegate complex reasoning to external thinker (Piano/OpenCode)",
  parameters: Type.Object({
    question: Type.String({
      description: "The question or problem needing deep thought",
    }),
  }),
  async execute(_id: string, params: { question: string }) {
    if (BYSELF) {
      return {
        content: [
          {
            type: "text" as const,
            text: "NuPI is in self-sufficient mode (BYSELF=true). Handle thinking yourself.",
          },
        ],
        details: {} as Record<string, unknown>,
      };
    }
    if (!externalThinkCallback) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No external thinker configured. Handle thinking yourself or check Piano setup.",
          },
        ],
        details: {} as Record<string, unknown>,
      };
    }
    const thinkingMsg = "🔄 Delegating to external thinker (Piano/OpenCode)...";
    try {
      const result = await externalThinkCallback(params.question);
      return {
        content: [{ type: "text" as const, text: result }],
        details: { from_external: true, delegated: true } as Record<
          string,
          unknown
        >,
      };
    } catch (e) {
      return {
        content: [
          { type: "text" as const, text: `External thinker failed: ${e}` },
        ],
        details: { error: true } as Record<string, unknown>,
      };
    }
  },
};

const nupiTasksTool = {
  name: "nupi-tasks",
  label: "NuPI Check Tasks",
  description: "Check pending tasks from Nezha",
  parameters: Type.Object({}),
  async execute() {
    const status = checkStartupTasks();
    return {
      content: [{ type: "text" as const, text: status }],
      details: {},
    };
  },
};

const nupiAutonomousTool = {
  name: "nupi-autonomous",
  label: "NuPI Autonomous Work",
  description: "Get guidance for autonomous work - suggests next actions based on pending tasks and context",
  parameters: Type.Object({
    context: Type.Optional(Type.String({ description: "Current work context or project being worked on" })),
  }),
  async execute(_id: string, params: { context?: string }) {
    // Get pending tasks
    const result = execNezha(["tasks", "--status", "PENDING"]);
    if (!result) {
      return {
        content: [{ type: "text" as const, text: "Could not retrieve tasks from Nezha." }],
        details: { error: true } as Record<string, unknown>,
      };
    }
    
    // Build guidance message
    const lines = result.split("\n").filter(l => l.trim());
    const tasks = lines.filter(l => l.match(/^\[\d+\]/));
    
    if (tasks.length === 0) {
      const guidance = `No pending tasks found.

Suggested actions:
1. Review recent changes with git log
2. Check for documentation updates needed
3. Run tests to ensure everything is working
4. Create new tasks for planned features${params.context ? `\n5. Continue working on: ${params.context}` : ""}`;
      return {
        content: [{ type: "text" as const, text: guidance }],
        details: { hasTasks: false } as Record<string, unknown>,
      };
    }
    
    // High priority tasks
    const highPriority = tasks.filter(t => {
      const match = t.match(/\[(\d+)\]/);
      return match && parseInt(match[1]) >= 80;
    });
    
    if (highPriority.length > 0) {
      const guidance = `🎯 HIGH PRIORITY TASKS (${highPriority.length}):
${highPriority.slice(0, 5).join("\n")}

Recommended immediate actions:
1. Focus on highest priority task first
2. Use 'piano_think' for complex analysis
3. Break down large tasks if needed${params.context ? `\n4. Current context: ${params.context}` : ""}`;
      return {
        content: [{ type: "text" as const, text: guidance }],
        details: { hasTasks: true, highPriority: true } as Record<string, unknown>,
      };
    }
    
    // Normal priority
    const guidance = `📋 PENDING TASKS (${tasks.length}):
${tasks.slice(0, 5).join("\n")}

Suggested workflow:
1. Pick a task that matches your current context
2. Use 'piano_think' for analysis
3. Update task status as you progress${params.context ? `\n\nCurrent context: ${params.context}` : ""}`;
    return {
      content: [{ type: "text" as const, text: guidance }],
      details: { hasTasks: true } as Record<string, unknown>,
    };
  },
};

export default function nupiExtension(pi: ExtensionAPI) {
  pi.registerTool(nupiThinkTool);
  pi.registerTool(nupiTasksTool);
  pi.registerTool(nupiAutonomousTool);

  pi.on("before_agent_start", async (_event: BeforeAgentStartEvent) => {
    return {
      systemPrompt: NEZHA_PROMPT,
    };
  });

  pi.on("session_start", async (event) => {
    // Create task for session start
    await execNezha([
      "task-add",
      `[Pi Session Started] ${event.reason}`,
      "Auto-created by NuPI extension",
    ]);

    // Show startup task status
    const taskStatus = checkStartupTasks();
    console.log(`[NuPI Startup] ${taskStatus}`);
  });

  pi.on("tool_result", async (event: ToolResultEvent) => {
    if (event.isError) {
      const toolName = event.toolName;
      await execNezha([
        "issue-add",
        `[Tool Failed] ${toolName}`,
        `--severity`,
        "medium",
        "--tag",
        "pi-tool-failure",
      ]);
    } else {
      if (
        event.toolName === "read" ||
        event.toolName === "edit" ||
        event.toolName === "write"
      ) {
        fileChangeCount++;
      }
    }
  });

  pi.on("turn_end", async (_event: TurnEndEvent, ctx) => {
    turnCount++;
    if (turnCount % 5 === 0) {
      await ctx.ui.notify(
        `💡 You've been working for ${turnCount} turns. Remember to commit your changes with \`git add . && git commit -m "[task: xxx] description"\``,
        "info",
      );
    }
    if (fileChangeCount > 10) {
      await ctx.ui.notify(
        `📝 You've edited ${fileChangeCount} files. Consider updating docs if you've made significant changes.`,
        "info",
      );
      fileChangeCount = 0;
    }
  });
}
