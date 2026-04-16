import type { WorkflowStore } from "@closeclaw/workflow";

export function runWorkflowDisable(
  store: WorkflowStore,
  workflowId: string,
): void {
  const wf = store.getWorkflow(workflowId);
  if (!wf) {
    console.error(`Workflow "${workflowId}" not found.`);
    return;
  }
  if (wf.status === "disabled") {
    console.log(`Workflow "${wf.name}" is already disabled.`);
    return;
  }
  store.updateWorkflow(workflowId, { status: "disabled" });
  console.log(`Workflow "${wf.name}" disabled.`);
}
