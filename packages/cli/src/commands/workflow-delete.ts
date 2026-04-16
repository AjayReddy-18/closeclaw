import type { WorkflowStore } from "@closeclaw/workflow";

export function runWorkflowDelete(
  store: WorkflowStore,
  workflowId: string,
): void {
  const removed = store.deleteWorkflow(workflowId);
  if (removed) {
    console.log(`Workflow ${workflowId} deleted.`);
  } else {
    console.error(`Workflow ${workflowId} not found.`);
  }
}
