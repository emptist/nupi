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

function execNezha(args: string[]): boolean {
  try {
    execSync(`nezha ${args.join(" ")}`, {
      encoding: "utf-8",
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

const NEZHA_PROMPT = `
## Nezha Integration
You have access to Nezha coordination layer via NuPI:
- Tasks: 'nezha task-add <title> [desc]' to create tasks
- Issues: 'nezha issue-add <title> [--severity] [--tag]' to create issues
- View: 'nezha tasks' or 'nezha issue-list' to see existing work
- Meetings: 'nezha meeting discuss <topic> <description>' for AI discussions

Use these to track progress, create issues for bugs, and collaborate with other AI instances.

💡 Pro tip: You can extend this extension with Pi hooks at ~/.pi/agent/extensions/ for custom reminders, automation, or context injection.

## Mode: ${BYSELF ? "Self-sufficient (BYSELF)" : "External Thinker (Piano)"}
${BYSELF ? "You handle thinking yourself." : "Use 'nupi-think' tool to delegate complex reasoning to external thinker."}
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
    // Show feedback that delegation is happening
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

export default function nupiExtension(pi: ExtensionAPI) {
  pi.registerTool(nupiThinkTool);

  pi.on("before_agent_start", async (_event: BeforeAgentStartEvent) => {
    return {
      systemPrompt: NEZHA_PROMPT,
    };
  });

  pi.on("session_start", async (event) => {
    await execNezha([
      "task-add",
      `[Pi Session Started] ${event.reason}`,
      "Auto-created by NuPI extension",
    ]);
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
