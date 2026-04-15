import { logger } from 'nezha';
import { getNuPIClient } from './NuPIClient.js';

export interface TraeRecoveryConfig {
  enabled: boolean;
  checkIntervalMs: number;
  failedTaskResetDelayMs: number;
  maxAutoRetries: number;
  dlqRetryDelayMs: number;
  minTasksForRecovery: number;
}

const DEFAULT_CONFIG: TraeRecoveryConfig = {
  enabled: true,
  checkIntervalMs: 60000,
  failedTaskResetDelayMs: 300000,
  maxAutoRetries: 3,
  dlqRetryDelayMs: 300000,
  minTasksForRecovery: 1,
};

export class TraeAutoRecoveryService {
  private config: TraeRecoveryConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config: Partial<TraeRecoveryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    if (this.intervalId) {
      logger.warn('[TraeAutoRecovery] Service already running');
      return;
    }

    logger.info('[TraeAutoRecovery] Starting automatic recovery service');
    this.isRunning = true;

    this.intervalId = setInterval(() => {
      this.runRecoveryCycle().catch(error => {
        logger.error('[TraeAutoRecovery] Recovery cycle error:', error);
      });
    }, this.config.checkIntervalMs);

    this.runRecoveryCycle().catch(error => {
      logger.error('[TraeAutoRecovery] Initial recovery cycle error:', error);
    });
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('[TraeAutoRecovery] Service stopped');
  }

  private async runRecoveryCycle(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    logger.debug('[TraeAutoRecovery] Running recovery cycle');

    const results = await Promise.allSettled([
      this.recoverFailedTasks(),
      this.recoverStuckTasks(),
      this.retryDLQItems(),
    ]);

    const summary = {
      failedTasks: results[0].status === 'fulfilled' ? results[0].value : 0,
      stuckTasks: results[1].status === 'fulfilled' ? results[1].value : 0,
      dlqItems: results[2].status === 'fulfilled' ? results[2].value : 0,
    };

    if (summary.failedTasks > 0 || summary.stuckTasks > 0 || summary.dlqItems > 0) {
      logger.info('[TraeAutoRecovery] Recovery cycle complete:', summary);
    }
  }

  async recoverFailedTasks(): Promise<number> {
    const api = getNuPIClient();

    try {
      const result = await api.recoverFailedTasks({
        maxRetries: this.config.maxAutoRetries,
        delayMs: this.config.failedTaskResetDelayMs,
      });

      if (result.recovered > 0) {
        logger.info(
          `[TraeAutoRecovery] Recovered ${result.recovered} failed tasks`
        );
      }

      return result.recovered;
    } catch (error) {
      logger.error(`[TraeAutoRecovery] Failed to recover tasks:`, error);
      return 0;
    }
  }

  async recoverStuckTasks(): Promise<number> {
    const api = getNuPIClient();

    try {
      const result = await api.recoverStuckTasks();

      if (result.recovered > 0) {
        logger.warn(
          `[TraeAutoRecovery] Recovered ${result.recovered} stuck tasks`
        );
      }

      return result.recovered;
    } catch (error) {
      logger.error(`[TraeAutoRecovery] Failed to recover stuck tasks:`, error);
      return 0;
    }
  }

  async retryDLQItems(): Promise<number> {
    const api = getNuPIClient();

    try {
      const stats = await api.getRecoveryStats();

      if (stats.dlqItemsPending === 0) {
        return 0;
      }

      const serviceHealthy = await api.isHealthy();

      if (!serviceHealthy) {
        logger.debug('[TraeAutoRecovery] Service not healthy, skipping DLQ retry');
        return 0;
      }

      const result = await api.retryDLQ({
        maxRetries: this.config.maxAutoRetries,
        delayMs: this.config.dlqRetryDelayMs,
      });

      if (result.retried > 0) {
        logger.info(`[TraeAutoRecovery] Auto-retried ${result.retried} DLQ items`);
      }

      return result.retried;
    } catch (error) {
      logger.error(`[TraeAutoRecovery] Failed to retry DLQ items:`, error);
      return 0;
    }
  }

  async getRecoveryStats(): Promise<{
    failedTasksRecoverable: number;
    stuckTasks: number;
    dlqItemsPending: number;
  }> {
    const api = getNuPIClient();
    return api.getRecoveryStats();
  }
}
