#!/usr/bin/env node

/**
 * NuPI Heartbeat CLI
 * 
 * 使用 nezha 的 HeartbeatService 保持 AI 持续工作
 */

import { createHeartbeatService, HeartbeatService } from '../dist/services/NuPIHeartbeatService.js';
import { logger } from 'nezha';

const args = process.argv.slice(2);
const command = args[0] || 'start';

let heartbeat: HeartbeatService | null = null;

async function main() {
  switch (command) {
    case 'start':
      console.log('[NuPI] Starting HeartbeatService...');
      heartbeat = await createHeartbeatService({
        heartbeatIntervalMs: 60000,
        enableReminder: true,
      });
      await heartbeat.start();
      console.log('[NuPI] HeartbeatService running. Press Ctrl+C to stop.');
      break;

    case 'status':
      console.log('[NuPI] Checking status...');
      if (heartbeat) {
        console.log('Running:', heartbeat.isRunning());
      } else {
        console.log('Heartbeat not started. Run "nupi heartbeat start" first.');
      }
      break;

    default:
      console.log('Usage: nupi-heartbeat [start|status]');
  }
}

process.on('SIGINT', async () => {
  console.log('\n[NuPI] Shutting down...');
  if (heartbeat) {
    await heartbeat.stop();
  }
  process.exit(0);
});

main().catch(error => {
  logger.error('[NuPI] Error:', error);
  process.exit(1);
});
