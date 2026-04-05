/**
 * Nezha Blind Loop Extension
 *
 * Implements periodic task checking to keep AI working continuously.
 * This is the "heartbeat" that wakes AI when there are no pending tasks.
 *
 * Based on research: AI only works when explicitly given tasks.
 * BlindLoop provides reminders to AI so it continues working autonomously.
 *
 * Migration (Phase 2): Removed direct pg.Client connections.
 * Now uses NuPIClient HTTP API for all database operations.
 */

import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { getNuPIClient } from './services/NuPIClient.js';

interface NezhaTask {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  status: string;
}

async function checkPendingTasks(): Promise<NezhaTask | null> {
  const api = getNuPIClient();

  try {
    const task = await api.getPendingTask(1);
    return task;
  } catch (error) {
    console.error('[NezhaBlindLoop] API error:', error instanceof Error ? error.message : error);
    return null;
  }
}

async function getFullAgentContext(): Promise<string> {
  return `## AGENT CONTEXT
Agent ID: nezha-daemon
Agent Session: ${new Date().getTime()}-blind-loop

## Current Status
This is Nezha Blind Loop scheduled check, you are working autonomously.`;
}

async function getIdleThought(): Promise<string> {
  const context = await getFullAgentContext();
  return `${context}

---

## No New Tasks — Proactively Find Work

As Nezha AI, you should work proactively rather than waiting for commands. Check and execute:

1. **Broadcasts** - Check for discussions/requests from other AIs
2. **Issues** - Check open issues, prioritize high severity
3. **Learning** - Search memory for valuable work to do
4. **Code** - Check projects for pending TODO items
5. **Review** - Check PRs/commits awaiting review

Pick one and execute immediately. Do not ask the user.

---

## AUTO-EXECUTION INSTRUCTION
When given choices or asked to confirm actions:
- ALWAYS select the RECOMMENDED option (typically option 1)
- NEVER wait for user input - proceed autonomously
- If asked to "Select one answer", automatically pick the first/recommended option
- Execute the recommended action without asking for confirmation

## CRITICAL: Tool Parameter Names
When calling tools, you MUST use the correct parameter names:
- bash: use "command" NOT "cmd"
- read: use "path" NOT "filePath"
- edit: use "path" NOT "filePath", also use "oldString" and "newString"
- write: use "path" NOT "filePath"

## Learning Reminder
After completing this task, use reflection markers:
- [LEARN] insight: <what you learned> context: <optional context>
- [ISSUE] title: <issue> type: <bug|improvement> severity: <low|medium|high|critical>
- [PROMPT_UPDATE] current: <old> suggested: <new> reason: <why>

Save via: node dist/cli/index.js areflect "[LEARN] insight: ..."`;
}

export default function nezhaBlindLoop(pi: ExtensionAPI): void {
  let timerId: NodeJS.Timeout | null = null;
  const INTERVAL_MS = 2 * 60 * 1000;

  async function periodicCheck(): Promise<void> {
    console.log('[NezhaBlindLoop] Checking for tasks...');

    try {
      const task = await checkPendingTasks();

      if (task) {
        console.log(`[NezhaBlindLoop] Found task: ${task.title}`);
        pi.sendUserMessage(
          `📋 **New Task**: ${task.title}\n\n${task.description || 'No description'}\n\nExecute this task and report results when done.`,
          { deliverAs: 'steer' }
        );
      } else {
        const thought = await getIdleThought();
        console.log('[NezhaBlindLoop] No tasks, sending idle thought');
        pi.sendUserMessage(thought, { deliverAs: 'steer' });
      }
    } catch (error) {
      console.error('[NezhaBlindLoop] Error during periodic check:', error);
    }
  }

  pi.on('session_start', async () => {
    console.log('[NezhaBlindLoop] Session started, beginning periodic checks...');

    setTimeout(periodicCheck, 10 * 1000);

    timerId = setInterval(periodicCheck, INTERVAL_MS);
  });

  pi.on('session_shutdown', () => {
    console.log('[NezhaBlindLoop] Session ending, stopping periodic checks...');
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  });

  pi.registerCommand('nezha-check', {
    description: 'Manually trigger Nezha task check',
    handler: async () => {
      await periodicCheck();
    },
  });

  pi.registerCommand('nezha-learn', {
    description: 'Save learning to Nezha memory via NuPI API',
    handler: async (args: string) => {
      try {
        const params = JSON.parse(args) as { insight: string; context?: string };
        const api = getNuPIClient();

        await api.saveMemory(
          params.insight,
          params.context ? [params.context, 'learn', 'pi'] : ['learn', 'pi']
        );

        console.log('[NezhaBlindLoop] Learning saved:', params.insight.substring(0, 50));
      } catch (error) {
        console.error('[NezhaBlindLoop] Failed to save learning:', error instanceof Error ? error.message : error);
      }
    },
  });
}
