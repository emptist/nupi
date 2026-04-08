/**
 * NuPI Auto-Work Extension for Pi
 *
 * Provides continuous work loop by:
 * 1. Checking for pending tasks on session start
 * 2. Prompting AI to check for work when idle
 * 3. Proactively finding work without user intervention
 *
 * This is PULL-based (AI queries when ready) not PUSH-based.
 */

import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { execSync } from 'child_process';

const NEZHA_API_PORT = 4099;
const NEZHA_API_HOST = 'localhost';

async function isNezhaApiRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(NEZHA_API_PORT, NEZHA_API_HOST);
  });
}

async function startNezha(): Promise<void> {
  console.log('[NuPI] Starting Nezha daemon...');
  try {
    execSync('cd /Users/jk/gits/hub/tools_ai/nezha && nohup node ./dist/cli/index.js start > /tmp/nezha.log 2>&1 &', {
      encoding: 'utf-8',
      timeout: 5000,
      shell: '/bin/bash',
    });
    console.log('[NuPI] Nezha daemon started.');
  } catch (e: any) {
    console.error('[NuPI] Failed to start Nezha daemon:', e.message);
  }
}

async function ensureNezhaApiRunning(): Promise<void> {
  console.log('[NuPI] Checking Nezha daemon status...');
  const isRunning = await isNezhaApiRunning();
  if (!isRunning) {
    console.log(`[NuPI] Nezha daemon not running on port ${NEZHA_API_PORT}, auto-starting...`);
    await startNezha();
    await new Promise((r) => setTimeout(r, 10000));
    const nowRunning = await isNezhaApiRunning();
    console.log(`[NuPI] Nezha daemon status after start: ${nowRunning ? 'RUNNING' : 'NOT RUNNING'}`);
  } else {
    console.log(`[NuPI] Nezha daemon already running on port ${NEZHA_API_PORT}`);
  }
}

const AUTO_WORK_PROMPT = `
## NuPI Auto-Work Mode (v2.0)

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
  pi.on('session_start', async () => {
    console.log('[NuPI v2.0] Auto-work mode starting...');
    
    await ensureNezhaApiRunning();

    pi.sendUserMessage(AUTO_WORK_PROMPT, { deliverAs: 'steer' });

    setTimeout(() => {
      pi.sendUserMessage('Starting autonomous work check... Run: nupi-status to see current state.', {
        deliverAs: 'steer',
      });
    }, 3000);
  });

  pi.registerCommand('nupi-start', {
    description: 'Start continuous work mode v2',
    handler: async () => {
      pi.sendUserMessage(AUTO_WORK_PROMPT, { deliverAs: 'steer' });
    },
  });

  pi.registerCommand('nupi-work', {
    description: 'Start autonomous work immediately',
    handler: async () => {
      pi.sendUserMessage(
        'Starting work cycle. Run: nupi-tasks, nupi-issues, check git status. Find something to do!',
        { deliverAs: 'steer' }
      );
    },
  });

  pi.registerCommand('nupi-share', {
    description: 'Broadcast message to all AIs',
    handler: async (args: string, ctx: any) => {
      if (!args.trim()) {
        ctx.ui.notify('Usage: /nupi-share <message>', 'warning');
        return;
      }
      const { execSync } = await import('child_process');
      try {
        execSync(
          `cd /Users/jk/gits/hub/tools_ai/nezha && node ./dist/cli/index.js share "${args.replace(/"/g, '\\"')}"`,
          { encoding: 'utf-8', timeout: 10000 }
        );
        ctx.ui.notify('Broadcast sent!', 'info');
      } catch (e: any) {
        ctx.ui.notify(`Broadcast failed: ${e.message}`, 'error');
      }
    },
  });

  console.log('[NuPI v2.0] Auto-work loaded with share command.');
}
