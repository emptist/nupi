/**
 * NuPI Auto-Work Extension for Pi
 *
 * Provides continuous work loop by:
 * 1. Checking for pending tasks on session start
 * 2. Prompting AI to check for work when idle
 * 3. Proactively finding work without user intervention
 * 4. Using Pi agent-loop for real continuous work
 *
 * IMPORTANT (2026-04-14): Uses CLI instead of HTTP for Nezha communication!
 */

import { isLocalTask, isSelfModelStrong } from "@nezha/nupi";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getNuPIClient } from "@nezha/nupi";
import { execSync } from "child_process";

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
    execSync("nezha status", { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

async function fetchWorkFromNezha(): Promise<WorkItem | null> {
  try {
    const tasksOutput = execSync("nezha tasks --status PENDING --limit 1", {
      timeout: 5000,
      encoding: "utf-8",
    });
    if (tasksOutput && !tasksOutput.includes("no tasks")) {
      const lines = tasksOutput.trim().split("\n");
      if (lines.length > 1) {
        const taskLine = lines[1];
        const match = taskLine.match(/^([a-f0-9-]+)\s+(.+)\s+\[(\w+)\]/);
        if (match) {
          return {
            type: "task",
            id: match[1],
            title: match[2],
            status: match[3],
          };
        }
      }
    }

    const issuesOutput = execSync("nezha issue-list --limit 3", {
      timeout: 5000,
      encoding: "utf-8",
    });
    if (issuesOutput && !issuesOutput.includes("no issues")) {
      const lines = issuesOutput.trim().split("\n");
      if (lines.length > 1) {
        const issueLine = lines[1];
        const match = issueLine.match(/^([a-f0-9-]+)\s+(.+)\s+\[(\w+)\]/);
        if (match) {
          return {
            type: "issue",
            id: match[1],
            title: match[2],
          };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

const NEZHA_DIR = process.env.NEZHA_DIR || "nezha";

async function startNezha(): Promise<boolean> {
  console.log("[NuPI] Starting Nezha...");
  try {
    const { spawn } = await import("child_process");
    const child = spawn("nezha", ["start"], {});
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

const DELEGATE_ONLY_PROMPT = `## NuPI Delegate-Only Mode

You are NuPI running on a weak local model. You CANNOT do coding tasks yourself.
Your ONLY job: find tasks and delegate them to OpenCode.

### What you CAN do:
- Run nupi-tasks to find pending work
- Run nupi-task-take <id> to claim a task
- Delegate the task to OpenCode (it will do the actual work)
- Run nupi-task-done <id> when OpenCode finishes

### What you MUST NOT do:
- Do NOT try to write or edit code yourself
- Do NOT try to read files and understand codebases
- Do NOT try to fix bugs or implement features

### Workflow:
1. nupi-tasks → pick highest priority
2. nupi-task-take <id>
3. Say: "Delegate this to OpenCode" with the task description
4. Wait for OpenCode result
5. nupi-task-done <id>
6. Repeat

### ALWAYS find the next task. NEVER stop. NEVER ask human.
`;

const AUTO_WORK_PROMPT = `## NuPI Auto-Work Mode (v2.1)

You are NuPI (Nezha united with PI), an autonomous AI worker.
Your goal: continuously find and complete work WITHOUT asking user.

### Critical: Check if Directory is Git Repo FIRST
- Before running git commands, check if current directory is a git repo
- Run: bash { command: "git rev-parse --git-dir" }
- If it fails with "not a git repository", SKIP all git operations
- Do NOT try git operations in non-git directories

### Critical: Tool Parameter Names (Pi v0.66+) - EXACT NAMES!

**bash**: key is "command" (SINGULAR!)
  ✅ { "command": "ls -la" }
  ❌ { "cmd": "ls -la" } - WRONG!

**read**: key is "path" (SINGULAR!)
  ✅ { "path": "src/index.ts" }
  ✅ { "path": "src/index.ts", "offset": 10, "limit": 50 }
  ❌ { "filePath": "..." } - WRONG!
  ❌ { "limits": ... } - WRONG! Use "limit" (singular)!

**write**: keys are "path" AND "content" (BOTH required!)
  ✅ { "path": "test.txt", "content": "hello" }
  ❌ { "content": "hello" } - WRONG! Missing "path"!

**edit**: keys are "path" AND "edits" (array!)
  ✅ { "path": "test.txt", "edits": [{ "oldText": "old", "newText": "new" }] }
  ❌ { "oldString": "old", "newString": "new" } - WRONG!

### COMMON MISTAKES TO AVOID:
- ❌ DO NOT use "filePath" - use "path"
- ❌ DO NOT use "cmd" - use "command"  
- ❌ write without "path" will FAIL
- ❌ edit without "edits" array will FAIL
- ❌ edit does NOT use "oldString"/"newString" - use "edits" array
- ❌ DO NOT use ~ in paths - ALWAYS expand to absolute path first!

### Tilde (~) Path Expansion - FAILS IF YOU USE ~!
- ⚠️ NEVER use ~ in ANY path - Pi will NOT expand it, command will FAIL
- ALWAYS run "bash { command: 'echo $HOME' }" FIRST to get /Users/jk
- Then use: { "path": "/Users/jk/gits/hub/tools_ai/..." }
- ❌ write ~/file.txt → FAILS
- ✅ echo $HOME → /Users/jk → write /Users/jk/file.txt → WORKS
- Example: ~/gits/hub/tools_ai/ → /Users/jk/gits/hub/tools_ai/
- ❌ NEVER do: read { "path": "~/..." }
- ✅ ALWAYS do: read { "path": "/Users/jk/..." }

### Pi Commands - HOW TO CALL (MUST FOLLOW)
- nupi-status is a Pi COMMAND, NOT bash command!
- DO NOT run: bash { "command": "nupi-status" } → FAILS!
- DO run: Just type "nupi-status" in your message (Pi will handle it)
- Or use: pi.sendUserMessage("nupi-status", { deliverAs: "steer" })
- Similarly: /nupi-share, /nupi-refresh, /nupi-mode, /nupi-work

### Path Handling - CRITICAL!
- Pi path-utils.ts resolveToCwd() prepends CWD to paths that DON'T start with /
- Problem: "Users/jk/gits/..." (no leading /) is treated as RELATIVE, becomes /cwd/Users/jk/...
- Solution: Always use paths with LEADING / for absolute, or relative paths without /
- Example: /Users/jk/gits/... (correct) vs Users/jk/gits/... (WRONG - missing /)

### Work Priority - Use HTTP API First (No path issues!):
1. **Check Pending Tasks** - Just type "nupi-tasks" (Pi command, NOT bash!)
2. **Check Open Issues** - Just type "nupi-issues" (Pi command!)
3. **Check Broadcasts** - Just type "nupi-status" (Pi command!)
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

### NEVER ask human for permission unless it is a risky task.
### Be CONCISE - NEVER explain tool parameters unprompted
### ALWAYS find the next thing to do.
### Work autonomously for 8 hours if needed.
### Use nupi-share to communicate with other AIs when needed.

**IMPORTANT**: NuPI NEVER delegates directly to OpenCode!
External mode means: create task in DB → Piano coordinates → OpenCode executes
`;

export default function nezhaAutoWork(pi: ExtensionAPI): void {
  let workCheckInterval: NodeJS.Timeout | null = null;
  const WORK_CHECK_INTERVAL_MS = 2 * 60 * 1000;

  async function checkAndDeliverWork(): Promise<void> {
    const work = await fetchWorkFromNezha();
    if (work) {
      const taskDesc = `${work.title} ${work.description || ""}`;

      console.log(
        `[NuPI] Got work: "${work.title.substring(0, 50)}" → local model`,
      );

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

    const opencodeRunning = await isNezhaApiRunning();
    const strongModel = isSelfModelStrong();

    if (strongModel) {
      const mode = opencodeRunning
        ? "🔗 External (OpenCode)"
        : "💻 Standalone (NuPI own strong model)";
      pi.sendUserMessage(`📊 NuPI Mode: ${mode}`, { deliverAs: "steer" });
      pi.sendUserMessage("Use /nupi-mode to check/switch", {
        deliverAs: "steer",
      });
      pi.sendUserMessage(AUTO_WORK_PROMPT, { deliverAs: "steer" });
    } else {
      pi.sendUserMessage(
        "📊 NuPI Mode: 🔗 Delegate-only (weak local model → OpenCode)",
        { deliverAs: "steer" },
      );
      pi.sendUserMessage(DELEGATE_ONLY_PROMPT, { deliverAs: "steer" });
    }

    setTimeout(() => {
      pi.sendUserMessage(
        "Starting autonomous work check... Run: nupi-status to see current state.",
        { deliverAs: "steer" },
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
    const input = event.input as Record<string, unknown>;

    if (event.toolName === "bash" && input.command) {
      const cmd = input.command as string;
      const dangerous =
        /^\s*(rm\s+(-[rf]+\s)*\/|sudo\s+rm\s|dd\s+if=|mkfs\.|>:?\s*\/dev\/)/;
      if (dangerous.test(cmd)) {
        ctx.ui.notify("Blocked dangerous command!", "error");
        return {
          block: true,
          reason: "NuPI: Dangerous command blocked for safety",
        };
      }
      if (cmd.includes("kill -9") || cmd.includes("kill -SIGKILL")) {
        const pidMatch = cmd.match(/kill\s+-9\s+(\d+)/);
        if (pidMatch) {
          ctx.ui.notify(`NuPI: Process ${pidMatch[1]} kill blocked`, "warning");
          return { block: true, reason: "NuPI: kill -9 blocked for safety" };
        }
      }
    }

    if (event.toolName === "read") {
      if (input.filePath && !input.path) {
        input.path = input.filePath;
        delete input.filePath;
      }
      if (input.path && typeof input.path !== "string") {
        input.path = String(input.path);
      }
      if (input.limits && !input.limit) {
        input.limit = input.limits;
        delete input.limits;
      }
      if (input.offset !== undefined && typeof input.offset === "string") {
        input.offset = parseInt(input.offset as string, 10);
      }
      if (input.limit !== undefined && typeof input.limit === "string") {
        input.limit = parseInt(input.limit as string, 10);
      }
    }

    if (event.toolName === "write") {
      if (!input.path && input.filePath) {
        input.path = input.filePath;
        delete input.filePath;
      }
      if (input.path && typeof input.path !== "string") {
        input.path = String(input.path);
      }
      if (!input.content && input.fileContent) {
        input.content = input.fileContent;
        delete input.fileContent;
      }
    }

    if (event.toolName === "edit") {
      if (!input.path && input.filePath) {
        input.path = input.filePath;
        delete input.filePath;
      }
      if (input.path && typeof input.path !== "string") {
        input.path = String(input.path);
      }
      if (!input.edits) {
        if (input.oldString && input.newString) {
          input.edits = [
            { oldText: input.oldString, newText: input.newString },
          ];
          delete input.oldString;
          delete input.newString;
        } else if (input.oldText && input.newText) {
          input.edits = [{ oldText: input.oldText, newText: input.newText }];
          delete input.oldText;
          delete input.newText;
        }
      }
      if (input.edits && !Array.isArray(input.edits)) {
        input.edits = [input.edits];
      }
      if (input.edits && Array.isArray(input.edits)) {
        input.edits = input.edits.map((e: unknown) => {
          const edit = e as Record<string, unknown>;
          if (edit.oldString && !edit.oldText) {
            edit.oldText = edit.oldString;
            delete edit.oldString;
          }
          if (edit.newString && !edit.newText) {
            edit.newText = edit.newString;
            delete edit.newString;
          }
          return edit;
        });
      }
    }

    if (event.toolName === "glob" || event.toolName === "find") {
      if (input.patterns && !input.pattern) {
        input.pattern = input.patterns;
        delete input.patterns;
      }
    }

    for (const toolName of ["read", "write", "edit", "glob", "find", "grep"]) {
      if (
        event.toolName === toolName &&
        input.path &&
        typeof input.path === "string"
      ) {
        const pathStr = input.path as string;
        if (pathStr.startsWith("~") || pathStr.includes("/~")) {
          input.path = pathStr
            .replace(/^~/, process.env.HOME || "/Users/jk")
            .replace(/\/~/g, (process.env.HOME || "/Users/jk") + "/");
        }
        const home = process.env.HOME || "/Users/jk";
        const homeSuffix = home.substring(1);
        const fixedPath = input.path as string;
        if (!fixedPath.startsWith("/") && fixedPath.startsWith(homeSuffix)) {
          input.path = "/" + fixedPath;
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
      try {
        const api = getNuPIClient();
        await api.sendBroadcast(args.trim());
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

  pi.registerCommand("nupi-mode", {
    description: "Show/switch NuPI mode (standalone|external)",
    handler: async (args: string, ctx: any) => {
      const opencodeRunning = await isNezhaApiRunning();
      const mode = opencodeRunning ? "external" : "standalone";

      if (!args.trim()) {
        // Show current mode
        const msg = opencodeRunning
          ? `🔗 External Mode: OpenCode available`
          : `💻 Standalone Mode: NuPI uses its own strong model (glm-4.5-flash)`;
        ctx.ui.notify(msg, "info");
        return;
      }

      // Mode switching - give feedback
      const newMode = args.trim().toLowerCase();
      if (newMode === "external" && !opencodeRunning) {
        ctx.ui.notify(`⚠️ External mode not available`, "error");
        return;
      }

      const feedback = `🔄 Mode: ${mode} → ${newMode}`;
      ctx.ui.notify(feedback, "success");

      if (newMode === "external") {
        ctx.ui.notify(
          `✅ Delegating to OpenCode for strong thinking`,
          "success",
        );
      } else {
        ctx.ui.notify(`💻 Using NuPI's own strong model`, "success");
      }
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
      const confirmed = await ctx.ui.confirm(
        "NuPI",
        "Reset and restart autonomous mode?",
      );
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
