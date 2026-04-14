/**
 * NuPI Tools Extension for Pi
 *
 * Provides access to NuPI (Nezha united with PI) via CLI.
 * Uses exec() to call nezha CLI - no HTTP needed!
 *
 * IMPORTANT (2026-04-14): CLI replaces HTTP - use `exec('nezha ...')`
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execSync } from "child_process";

function runNezha(args: string): string {
  try {
    return execSync(`nezha ${args}`, { timeout: 5000, encoding: "utf-8" });
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export default function nupiTools(pi: ExtensionAPI): void {
  pi.registerCommand("nupi-tasks", {
    description: "List pending tasks (NuPI)",
    handler: async () => {
      const output = runNezha("tasks --status PENDING --limit 10");
      if (output.includes("no tasks") || output.includes("No pending"))
        return "No pending tasks";
      return output;
    },
  });

  pi.registerCommand("nupi-task-take", {
    description: "Take a task by ID",
    handler: async (id?: string) => {
      if (!id) return "Usage: nupi-task-take <task-id>";
      return runNezha(`task-update ${id} --status RUNNING`);
    },
  });

  pi.registerCommand("nupi-task-done", {
    description: "Complete a task by ID",
    handler: async (taskId?: string) => {
      if (!taskId) return "Usage: nupi-task-done <task-id>";
      return runNezha(`task-update ${taskId} --status COMPLETED`);
    },
  });

  pi.registerCommand("nupi-issues", {
    description: "List open issues",
    handler: async () => {
      const output = runNezha("issue-list");
      if (output.includes("no issues")) return "No open issues";
      return output;
    },
  });

  pi.registerCommand("nupi-learn", {
    description: "Save learning insight",
    handler: async (insight?: string) => {
      if (!insight) return "Usage: nupi-learn <insight>";
      return runNezha(`learn "${insight}"`);
    },
  });

  pi.registerCommand("nupi-status", {
    description: "Show NuPI status",
    handler: async () => {
      return runNezha("status");
    },
  });

  pi.registerCommand("nupi-reflect", {
    description: "Parse reflection markers",
    handler: async (text?: string) => {
      if (!text) return 'Usage: nupi-reflect "[LEARN] insight: ..."';
      return runNezha(`areflect "${text}"`);
    },
  });
}
