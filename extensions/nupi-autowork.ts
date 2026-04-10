/**
 * NuPI Auto-Work Extension for Pi
 *
 * Provides continuous work loop by:
 * 1. Checking for pending tasks on session start
 * 2. Prompting AI to check for work when idle
 * 3. Proactively finding work without user intervention
 * 4. Using Pi agent-loop for real continuous work
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execSync } from "child_process";

const NEZHA_API_PORT = 5999;
const NEZHA_API_HOST = "localhost";

interface WorkItem {
  type: "task" | "issue" | "broadcast";
  id: string;
  title: string;
  description?: string;
  priority?: number;
  severity?: string;
}

async function isNezhaApiRunning(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:4099/health", {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchWorkFromNezha(): Promise<WorkItem | null> {
  try {
    const res = await fetch(
      "http://127.0.0.1:4099/tasks?status=PENDING&limit=1",
      {
        signal: AbortSignal.timeout(5000),
      },
    );
    if (res.ok) {
      const data = (await res.json()) as { rows?: WorkItem[] };
      if (data.rows && data.rows.length > 0) {
        return { type: "task", ...data.rows[0] };
      }
    }

    const issueRes = await fetch("http://127.0.0.1:4099/issues?limit=3", {
      signal: AbortSignal.timeout(5000),
    });
    if (issueRes.ok) {
      const issueData = (await issueRes.json()) as { rows?: WorkItem[] };
      if (issueData.rows && issueData.rows.length > 0) {
        const highPriority = issueData.rows.find(
          (i) => i.severity === "high" || i.severity === "critical",
        );
        return highPriority
          ? { type: "issue", ...highPriority }
          : { type: "issue", ...issueData.rows[0] };
      }
    }

    const broadcastRes = await fetch("http://127.0.0.1:4099/broadcast/5", {
      signal: AbortSignal.timeout(5000),
    });
    if (broadcastRes.ok) {
      const broadcastData = (await broadcastRes.json()) as {
        rows?: WorkItem[];
      };
      if (broadcastData.rows && broadcastData.rows.length > 0) {
        return { type: "broadcast", ...broadcastData.rows[0] };
      }
    }

    return null;
  } catch {
    return null;
  }
}

const NEZHA_DIR =
  process.env.NEZHA_DIR ||
  (process.env.HOME ? `${process.env.HOME}/gits/hub/tools_ai/nezha` : null) ||
  "/Users/jk/gits/hub/tools_ai/nezha";

async function startNezha(): Promise<boolean> {
  console.log("[NuPI] Starting Nezha...");
  try {
    const { spawn } = await import("child_process");
    const child = spawn("node", ["./dist/cli/index.js", "start"], {
      cwd: NEZHA_DIR,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    console.log("[NuPI] Nezha started.");
    return true;
  } catch (e: any) {
    console.error("[NuPI] Failed to start Nezha:", e.message);
    return false;
  }
}

async function ensureNezhaApiRunning(): Promise<void> {
  console.log("[NuPI] Checking Nezha status...");
  const isRunning = await isNezhaApiRunning();
  if (isRunning) {
    console.log("[NuPI] Nezha already running.");
    return;
  }

  console.log("[NuPI] Nezha not running, attempting start...");
  const started = await startNezha();

  if (!started) {
    console.error("[NuPI] Failed to start Nezha. Will retry on next cycle.");
    return;
  }

  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const nowRunning = await isNezhaApiRunning();
    if (nowRunning) {
      console.log("[NuPI] Nezha started successfully.");
      return;
    }
  }

  console.error("[NuPI] Nezha start timeout. Will retry later.");
}

const AUTO_WORK_PROMPT = `## NuPI Auto-Work Mode (v2.1)

You are NuPI (Nezha united with PI), an autonomous AI worker.
Your goal: continuously find and complete work WITHOUT asking user.

### Work Priority (check in order):
1. **Pending Tasks** - Run: nupi-tasks
2. **Open Issues** - Run: nupi-issues (priority: high severity)
3. **Git Status** - Check for uncommitted changes, pending PRs
4. **Code Review** - Check git log for recent commits needing review
5. **Documentation** - Update table_documentation if needed
6. **Learning** - Search memory: nupi-search <keyword>

### Task Workflow:
1. Run: nupi-tasks → pick highest priority
2. Run: nupi-task-take <id> → claim it
3. Do the work
4. Run: nupi-task-done <id> → complete
5. Run: nupi-learn "<what you learned>"

### Proactive Work Finder:
When idle, automatically:
- Check nezha broadcasts for other AI requests
- Review recent git commits for context
- Search memory for incomplete tasks
- Check table_documentation for gaps
- Look for TODO comments in code

### NEVER ask user for permission.
### ALWAYS find the next thing to do.
### Work autonomously for 8 hours if needed.
### Use nupi-share to communicate with other AIs when needed.

## Critical: Tool Parameter Names
- bash: use "command" NOT "cmd"
- read: use "path" NOT "filePath"
- edit: use "path" NOT "filePath", also use "oldString" and "newString"
- write: use "path" NOT "filePath"
`;

export default function nezhaAutoWork(pi: ExtensionAPI): void {
  let workCheckInterval: NodeJS.Timeout | null = null;
  const WORK_CHECK_INTERVAL_MS = 2 * 60 * 1000;

  async function checkAndDeliverWork(): Promise<void> {
    const work = await fetchWorkFromNezha();
    if (work) {
      let message = "";
      switch (work.type) {
        case "task":
          message = `📋 **New Task**: ${work.title}\n\n${work.description || "No description"}\n\nPriority: ${work.priority || "normal"}`;
          break;
        case "issue":
          message = `⚠️ **New Issue**: ${work.title}\n\n${work.description || ""}\n\nSeverity: ${work.severity || "unknown"}`;
          break;
        case "broadcast":
          message = `📢 **Broadcast**: ${work.title}`;
          break;
      }
      pi.sendUserMessage(message, { deliverAs: "steer" });
    }
  }

  async function initialSetup(): Promise<void> {
    console.log("[NuPI v2.1] Auto-work mode starting...");

    await ensureNezhaApiRunning();

    pi.sendUserMessage(AUTO_WORK_PROMPT, { deliverAs: "steer" });

    setTimeout(() => {
      pi.sendUserMessage(
        "Starting autonomous work check... Run: nupi-status to see current state.",
        {
          deliverAs: "steer",
        },
      );
    }, 3000);

    setTimeout(checkAndDeliverWork, 5000);

    workCheckInterval = setInterval(
      checkAndDeliverWork,
      WORK_CHECK_INTERVAL_MS,
    );
  }

  pi.on("session_start", initialSetup);

  pi.on("session_shutdown", () => {
    console.log("[NuPI v2.1] Session ending, stopping work checks...");
    if (workCheckInterval) {
      clearInterval(workCheckInterval);
      workCheckInterval = null;
    }
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command) {
      const cmd = event.input.command;
      const dangerous = /^\s*(rm\s+(-[rf]+\s)*\/|sudo\s+rm\s|dd\s+if=|mkfs\.|>:?\s*\/dev\/)/;
      if (dangerous.test(cmd)) {
        ctx.ui.notify("Blocked dangerous command!", "error");
        return { block: true, reason: "NuPI: Dangerous command blocked for safety" };
      }
      if (cmd.includes("kill -9") || cmd.includes("kill -SIGKILL")) {
        const pidMatch = cmd.match(/kill\s+-9\s+(\d+)/);
        if (pidMatch) {
          ctx.ui.notify(`NuPI: Process ${pidMatch[1]} kill blocked`, "warning");
          return { block: true, reason: "NuPI: kill -9 blocked for safety" };
        }
      }
    }
  });

  pi.registerCommand("nupi-start", {
    description: "Start continuous work mode v2",
    handler: async () => {
      pi.sendUserMessage(AUTO_WORK_PROMPT, { deliverAs: "steer" });
    },
  });

  pi.registerCommand("nupi-work", {
    description: "Start autonomous work immediately",
    handler: async () => {
      await checkAndDeliverWork();
    },
  });

  pi.registerCommand("nupi-status", {
    description: "Check NuPI and Nezha status",
    handler: async (args: string, ctx: any) => {
      const isRunning = await isNezhaApiRunning();
      const work = await fetchWorkFromNezha();

      let statusMessage = `**NuPI Status**\n- Nezha API: ${isRunning ? "✅ Running" : "❌ Not running"}`;

      if (work) {
        statusMessage += `\n- Next work: ${work.type}: ${work.title}`;
      } else {
        statusMessage += "\n- No pending work found";
      }

      ctx.ui.notify(statusMessage, "info");
    },
  });

  pi.registerCommand("nupi-share", {
    description: "Broadcast message to all AIs",
    handler: async (args: string, ctx: any) => {
      if (!args.trim()) {
        ctx.ui.notify("Usage: /nupi-share <message>", "warning");
        return;
      }
      const { execSync } = await import("child_process");
      const nezhaDir =
        process.env.NEZHA_DIR || "/Users/jk/gits/hub/tools_ai/nezha";
      const safeMessage = args.replace(/"/g, '\\"').replace(/;/g, "\\;");
      try {
        execSync(
          `cd ${nezhaDir} && node ./dist/cli/index.js share "${safeMessage}"`,
          { encoding: "utf-8", timeout: 10000 },
        );
        ctx.ui.notify("Broadcast sent!", "info");
      } catch (e: any) {
        ctx.ui.notify(`Broadcast failed: ${e.message}`, "error");
      }
    },
  });

  pi.registerCommand("nupi-refresh", {
    description: "Manually trigger work check",
    handler: async (args: string, ctx: any) => {
      await checkAndDeliverWork();
      ctx.ui.notify("Work check triggered", "info");
    },
  });

  console.log("[NuPI v2.1] Auto-work loaded with agent-loop integration.");
}
