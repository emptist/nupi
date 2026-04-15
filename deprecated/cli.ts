import { getNuPIClient } from "./services/NuPIClient.js";

const command = process.argv[2] || "status";

async function main(): Promise<void> {
  const client = getNuPIClient();

  if (!(await client.isHealthy())) {
    console.error("Nezha DB not reachable");
    process.exit(1);
  }

  switch (command) {
    case "status": {
      const s = await client.getSystemStatus();
      console.log(`Pending tasks: ${s.pendingTasks}`);
      console.log(`Open issues: ${s.openIssues}`);
      console.log(`Memories: ${s.memoryCount}`);
      break;
    }
    case "tasks": {
      const status = process.argv[3] || "PENDING";
      const limit = parseInt(process.argv[4] || "20", 10);
      const result = await client.getTasks({ status, limit });
      if (!result.rows.length) {
        console.log("No tasks found.");
        break;
      }
      for (const t of result.rows) {
        console.log(`[P${t.priority}] ${t.title} (${t.id.slice(0, 8)}) [${t.status}]`);
        if (t.description) console.log(`  ${t.description.slice(0, 200)}`);
      }
      break;
    }
    case "issues": {
      const limit = parseInt(process.argv[3] || "10", 10);
      const issues = await client.getIssues(limit);
      if (!Array.isArray(issues) || !issues.length) {
        console.log("No open issues.");
        break;
      }
      for (const i of issues as any[]) {
        console.log(`[${i.severity || "?"}] ${i.title} (${i.id.slice(0, 8)})`);
      }
      break;
    }
    case "broadcasts": {
      const limit = parseInt(process.argv[3] || "10", 10);
      const broadcasts = await client.getBroadcasts(limit);
      if (!Array.isArray(broadcasts) || !broadcasts.length) {
        console.log("No recent broadcasts.");
        break;
      }
      for (const b of broadcasts as any[]) {
        const msg = b.message || b.content || String(b);
        console.log(`- ${msg.slice(0, 200)}`);
      }
      break;
    }
    case "create-task": {
      const title = process.argv[3];
      if (!title) {
        console.error("Usage: nupi create-task <title> [description] [priority]");
        process.exit(1);
      }
      const description = process.argv[4];
      const priority = parseInt(process.argv[5] || "5", 10);
      const result = await client.createTask({ title, description, priority });
      console.log(`Task created: ${title} (id: ${result.id})`);
      break;
    }
    case "health": {
      const h = await client.health();
      console.log(`${h.status} - ${h.service}`);
      break;
    }
    default:
      console.error("Usage: nupi [command]");
      console.error("");
      console.error("Commands:");
      console.error("  status                    System overview (default)");
      console.error("  tasks [status] [n]        List tasks (default: PENDING, 20)");
      console.error("  issues [n]                List open issues (default: 10)");
      console.error("  broadcasts [n]            Recent broadcasts (default: 10)");
      console.error("  create-task <title> [desc] [priority]  Create a task");
      console.error("  health                    DB health check");
      console.error("");
      console.error("For AI-powered work, use pi with nupi extension:");
      console.error("  import nupiExtension from '@nezha/nupi/extension'");
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
