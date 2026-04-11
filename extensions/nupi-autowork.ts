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
    const res = await fetch(`http://${NEZHA_API_HOST}:${NEZHA_API_PORT}/health`, {
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
      `http://${NEZHA_API_HOST}:${NEZHA_API_PORT}/tasks?status=PENDING&limit=1`,
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

    const issueRes = await fetch(`http://${NEZHA_API_HOST}:${NEZHA_API_PORT}/issues?limit=3`, {
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

    const broadcastRes = await fetch(`http://${NEZHA_API_HOST}:${NEZHA_API_PORT}/broadcast/5`, {
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

### Critical: Check if Directory is Git Repo FIRST
- Before running git commands, check if current directory is a git repo
- Run: bash { command: "git rev-parse --git-dir" }
- If it fails with "not a git repository", SKIP all git operations
- Do NOT try git operations in non-git directories

### Critical: Tool Parameter Names (Pi v0.66+) - COPY EXACTLY!

**bash**: use "command" (string), NOT "cmd"
  Example: { "command": "ls -la" }

**read**: use "path" (string), NOT "filePath"
  Example: { "path": "src/index.ts" }

**write**: BOTH "path" AND "content" required!
  Example: { "path": "test.txt", "content": "hello world" }

**edit**: use "path" AND "edits" (array of {oldText, newText})
  Example: { "path": "test.txt", "edits": [{ "oldText": "old", "newText": "new" }] }

### COMMON MISTAKES TO AVOID:
- ❌ DO NOT use "filePath" - use "path"
- ❌ DO NOT use "cmd" - use "command"  
- ❌ write without "path" will FAIL
- ❌ edit without "edits" array will FAIL
- ❌ edit does NOT use "oldString"/"newString" - use "edits" array
- ❌ DO NOT use ~ in paths - ALWAYS expand to absolute path first!

### Tilde (~) Path Expansion - CRITICAL!
- Pi does NOT expand ~ in file paths automatically
- Before using read/write/edit on any path containing ~, you MUST convert it:
- Example: ~/gits/hub/tools_ai/ → /Users/jk/gits/hub/tools_ai/
- Use bash to get absolute path: { "command": "echo ~" } then construct full path

### Work Priority - Use NuPI Tools First (HTTP API, no path issues):
1. **Check Pending Tasks** - Run: nupi-tasks (HTTP API, always works)
2. **Check Open Issues** - Run: nupi-issues (HTTP API)
3. **Check Broadcasts** - Run: nupi-status (HTTP API)
4. **If you must use files**: Use ABSOLUTE paths only, NEVER use ~
   - ❌ BAD: ~/gits/hub/ → becomes /Users/jk/.../~/gits/hub/ (WRONG!)
   - ✅ GOOD: /Users/jk/gits/hub/tools_ai/ (correct)
   - Get home dir: bash { "command": "echo $HOME" }

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

  pi.on("session_start", async (event, ctx) => {
    console.log("[NuPI v2.1] Session starting, restoring state...");

    for (const entry of ctx.sessionManager.getEntries()) {
      if (entry.type === "custom" && entry.customType === "nupi-work-state") {
        console.log("[NuPI] Restored work state:", entry.data);
      }
    }

    await initialSetup();
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    console.log("[NuPI v2.1] Session ending, saving work state...");

    if (workCheckInterval) {
      clearInterval(workCheckInterval);
      workCheckInterval = null;
    }

    pi.appendEntry("nupi-work-state", {
      lastCheck: new Date().toISOString(),
      workMode: "autonomous",
    });
  });

  pi.on("before_agent_start", async (event, ctx) => {
    ctx.ui.notify("NuPI: Agent starting work...", "info");
  });

  pi.on("turn_start", async (event, ctx) => {
    console.log("[NuPI] Turn", event.turnIndex, "started");
  });

  pi.on("turn_end", async (event, ctx) => {
    console.log("[NuPI] Turn", event.turnIndex, "ended");
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

  pi.registerCommand("nupi-model", {
    description: "Switch Pi model",
    handler: async (model: string, ctx: any) => {
      if (!model.trim()) {
        const current = pi.getThinkingLevel();
        ctx.ui.notify(`Current thinking: ${current}`, "info");
        return;
      }
      const level = pi.setThinkingLevel(model as any);
      if (level) {
        ctx.ui.notify(`Thinking level set to: ${model}`, "success");
      } else {
        ctx.ui.notify(`Failed to set thinking: ${model}`, "error");
      }
    },
  });

  pi.registerCommand("nupi-prompt", {
    description: "Re-prompt autonomous work mode",
    handler: async (args: string, ctx: any) => {
      const confirmed = await ctx.ui.confirm("NuPI", "Reset and restart autonomous mode?");
      if (confirmed) {
        pi.sendUserMessage(AUTO_WORK_PROMPT, { deliverAs: "steer" });
        ctx.ui.notify("Autonomous mode restarted", "success");
      } else {
        ctx.ui.notify("Cancelled", "info");
      }
    },
  });

  console.log("[NuPI v2.1] Auto-work loaded with ctx.ui integration.");
}
