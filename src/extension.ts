import type { ExtensionAPI, BeforeAgentStartEvent, ToolResultEvent } from "@mariozechner/pi-coding-agent";
import { execSync } from "child_process";

function execNezha(args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      execSync(`nezha ${args.join(" ")}`, {
        encoding: "utf-8",
        timeout: 5000,
      });
      resolve(true);
    } catch {
      resolve(false);
    }
  });
}

const NEZHA_PROMPT = `
## Nezha Integration
You have access to Nezha coordination layer via NuPI:
- Tasks: 'nezha task-add <title> [desc]' to create tasks
- Issues: 'nezha issue-add <title> [--severity] [--tag]' to create issues
- View: 'nezha tasks' or 'nezha issue-list' to see existing work
- Meetings: 'nezha meeting discuss <topic> <description>' for AI discussions

Use these to track progress, create issues for bugs, and collaborate with other AI instances.
`.trim();

export default function nupiExtension(pi: ExtensionAPI) {
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
    }
  });
}
