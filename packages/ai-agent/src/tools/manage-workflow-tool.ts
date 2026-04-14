import { z } from "zod";
import { tool } from "ai";

const manageSchema = z.object({
  action: z.enum(["list", "enable", "disable", "delete", "history"]),
  workflowId: z.string().optional(),
  workflowName: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

interface WorkflowStoreView {
  listWorkflows(platform: string, senderId: string): unknown[];
  getWorkflow(id: string): unknown | undefined;
  updateWorkflow(id: string, updates: Record<string, unknown>): void;
  deleteWorkflow(id: string): boolean;
  getExecutions(workflowId: string, limit?: number): unknown[];
}

export function createManageWorkflowTool(
  store: WorkflowStoreView,
  platform: string,
  senderId: string,
) {
  return tool({
    description:
      "Manage saved workflows: list, enable, disable, delete, or view history.",
    inputSchema: manageSchema,
    execute: async (params) =>
      dispatch(params, store, platform, senderId),
  });
}

async function dispatch(
  params: z.infer<typeof manageSchema>,
  store: WorkflowStoreView,
  platform: string,
  senderId: string,
): Promise<unknown> {
  switch (params.action) {
    case "list":
      return store.listWorkflows(platform, senderId);
    case "enable":
      return handleToggle(store, params.workflowId, "active");
    case "disable":
      return handleToggle(store, params.workflowId, "disabled");
    case "delete":
      return handleDelete(store, params.workflowId);
    case "history":
      return store.getExecutions(
        params.workflowId ?? "",
        params.limit ?? 10,
      );
  }
}

function handleToggle(
  store: WorkflowStoreView,
  workflowId: string | undefined,
  status: string,
): { updated: boolean } {
  if (!workflowId) return { updated: false };
  store.updateWorkflow(workflowId, { status });
  return { updated: true };
}

function handleDelete(
  store: WorkflowStoreView,
  workflowId: string | undefined,
): { deleted: boolean } {
  if (!workflowId) return { deleted: false };
  const result = store.deleteWorkflow(workflowId);
  return { deleted: result };
}
