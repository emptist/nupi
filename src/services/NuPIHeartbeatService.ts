/**
 * NuPI Heartbeat Service
 * 
 * 直接使用 nezha 的 HeartbeatService
 */

import { HeartbeatService, type HeartbeatConfig, logger, Config } from 'nezha';
import { DatabaseClient as DbClient } from 'nezha/dist/db/DatabaseClient.js';

export { HeartbeatService };

export interface NuPIHeartbeatConfig extends HeartbeatConfig {
  enablePi?: boolean;
}

export function createHeartbeatService(config?: NuPIHeartbeatConfig) {
  const db = new DbClient(Config.getInstance());
  const heartbeat = new HeartbeatService(db, {
    heartbeatIntervalMs: config?.heartbeatIntervalMs || 60000,
    enableReminder: true,
    enablePi: config?.enablePi || false,
  });
  
  logger.info('[NuPI] HeartbeatService created from nezha package');
  return heartbeat;
}
