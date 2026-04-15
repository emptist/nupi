/**
 * NuPI Heartbeat Service
 *
 * Creates a HeartbeatService instance for use within the Nezha daemon.
 * Prefer using the daemon's shared DatabaseClient rather than creating new connections.
 */

import { HeartbeatService, type HeartbeatConfig, logger, Config, type DatabaseClient } from 'nezha';

export { HeartbeatService };

export interface NuPIHeartbeatConfig extends HeartbeatConfig {
  enablePi?: boolean;
}

let _dbClientPromise: Promise<typeof DatabaseClient> | null = null;

function getDbClient(): Promise<typeof DatabaseClient> {
  if (!_dbClientPromise) {
    _dbClientPromise = import('nezha/dist/db/DatabaseClient.js').then(mod => mod.DatabaseClient);
  }
  return _dbClientPromise;
}

export async function createHeartbeatService(config?: NuPIHeartbeatConfig, db?: DatabaseClient) {
  const dbClient = db ?? new (await getDbClient())(Config.getInstance());
  const heartbeat = new HeartbeatService(dbClient, {
    heartbeatIntervalMs: config?.heartbeatIntervalMs || 60000,
    enableReminder: true,
    enablePi: config?.enablePi || false,
  });

  logger.info('[NuPI] HeartbeatService created from nezha package');
  return heartbeat;
}
