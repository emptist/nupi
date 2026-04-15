// NuPIClient - uses Nezha NPM package directly (no HTTP)

import { DatabaseClient, Config, logger } from "nezha";

export interface TaskData {
  id?: string;
  title: string;
  description?: string;
  type?: string;
  priority?: number;
  category?: string;
  status?: string;
}

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  status: string;
  category: string | null;
  type: string | null;
  created_at: string;
}

export class NuPIClient {
  private db: DatabaseClient;

  constructor() {
    const config = Config.getInstance();
    this.db = new DatabaseClient(config);
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.db.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async getTasks(options?: {
    status?: string;
    limit?: number;
  }): Promise<{ rows: TaskRow[] }> {
    const limit = options?.limit ?? 10;
    const status = options?.status ?? "PENDING";

    const result = await this.db.query(
      `SELECT id, title, description, priority, status, category, type, created_at 
       FROM tasks WHERE status = $1 ORDER BY priority DESC, created_at DESC LIMIT $2`,
      [status, limit],
    );
    return { rows: result.rows as TaskRow[] };
  }

  async createTask(data: TaskData): Promise<string> {
    const id = crypto.randomUUID();
    await this.db.query(
      `INSERT INTO tasks (id, title, description, status, priority, category) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        data.title,
        data.description || "",
        data.status || "PENDING",
        data.priority ?? 5,
        data.category || "feature",
      ],
    );
    return id;
  }

  async getSystemStatus(): Promise<{
    pendingTasks: number;
    openIssues: number;
    memoryCount: number;
  }> {
    const tasks = await this.db.query(
      "SELECT COUNT(*) as c FROM tasks WHERE status = 'PENDING'",
    );
    const issues = await this.db.query(
      "SELECT COUNT(*) as c FROM issues WHERE status != 'RESOLVED'",
    );
    const memory = await this.db.query("SELECT COUNT(*) as c FROM memory");
    return {
      pendingTasks: parseInt(tasks.rows[0]?.c || "0", 10),
      openIssues: parseInt(issues.rows[0]?.c || "0", 10),
      memoryCount: parseInt(memory.rows[0]?.c || "0", 10),
    };
  }

  async getIssues(_options?: {
    status?: string;
    limit?: number;
  }): Promise<{ rows: any[] }> {
    return { rows: [] };
  }

  async getBroadcasts(): Promise<{ rows: any[] }> {
    return { rows: [] };
  }

  async getPendingTask(): Promise<TaskRow | null> {
    const result = await this.db.query(
      "SELECT * FROM tasks WHERE status = 'PENDING' ORDER BY priority DESC, created_at DESC LIMIT 1",
    );
    return (result.rows[0] as TaskRow) || null;
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}

let client: NuPIClient | null = null;

export function getNuPIClient(): NuPIClient {
  if (!client) {
    client = new NuPIClient();
  }
  return client;
}
