// NuPI Tools - Array of tools for Pi SDK
import { Type } from "@sinclair/typebox";
import { defineTool } from "@mariozechner/pi-coding-agent";
import { getNuPIClient, type TaskRow } from "./NuPIClient.js";

const client = getNuPIClient();

// Nezha Status Tool
const nezhaStatusTool = defineTool({
  name: "nezha_status",
  label: "Nezha Status",
  description: "Get system status: pending tasks, open issues, memory count.",
  parameters: Type.Object({}),
  async execute() {
    try {
      const healthy = await client.isHealthy();
      if (!healthy) {
        return {
          content: [{ type: "text", text: "Nezha DB not reachable." }],
          details: {},
        };
      }
      const status = await client.getSystemStatus();
      return {
        content: [
          {
            type: "text",
            text: `${status.pendingTasks} tasks, ${status.openIssues} issues, ${status.memoryCount} memories`,
          },
        ],
        details: {},
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e}` }], details: {} };
    }
  },
});

// Nezha Get Tasks Tool
const nezhaGetTasksTool = defineTool({
  name: "nezha_get_tasks",
  label: "Nezha Get Tasks",
  description: "Get tasks from Nezha",
  parameters: Type.Object({
    status: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Number()),
  }),
  async execute(_toolCallId, params) {
    try {
      const result = await client.getTasks({
        status: params.status,
        limit: params.limit,
      });
      if (!result.rows?.length)
        return { content: [{ type: "text", text: "No tasks" }], details: {} };
      const lines = result.rows.map(
        (t: TaskRow, i: number) =>
          `${i + 1}. [P${t.priority}] ${t.title} (${t.status})`,
      );
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: {},
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e}` }], details: {} };
    }
  },
});

// Nezha Create Task Tool
const nezhaCreateTaskTool = defineTool({
  name: "nezha_create_task",
  label: "Nezha Create Task",
  description: "Create a new task",
  parameters: Type.Object({
    title: Type.String(),
    description: Type.Optional(Type.String()),
    priority: Type.Optional(Type.Number()),
  }),
  async execute(_toolCallId, params) {
    try {
      const result = await client.createTask({
        title: params.title,
        description: params.description,
        priority: params.priority,
      });
      return {
        content: [{ type: "text", text: `Task created: ${params.title}` }],
        details: {},
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e}` }], details: {} };
    }
  },
});

// Export tools array
export const nupiTools = [
  nezhaStatusTool,
  nezhaGetTasksTool,
  nezhaCreateTaskTool,
];
