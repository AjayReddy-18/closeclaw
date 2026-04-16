import type { WorkflowStore } from "@closeclaw/workflow";

export function runWorkflowEnable(
  store: WorkflowStore,
  workflowId: string,
): void {
  const wf = store.getWorkflow(workflowId);
  if (!wf) {
    console.error(`Workflow "${workflowId}" not found.`);
    return;
  }
  if (wf.status === "active") {
    console.log(`Workflow "${wf.name}" is already active.`);
    return;
  }
  store.updateWorkflow(workflowId, { status: "active" });
  console.log(`Workflow "${wf.name}" enabled.`);
}
