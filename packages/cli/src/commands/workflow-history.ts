import type { WorkflowStore } from "@closeclaw/workflow";

export function runWorkflowHistory(
  store: WorkflowStore,
  workflowId: string,
  limit = 20,
): void {
  const wf = store.getWorkflow(workflowId);
  if (!wf) {
    console.error(`Workflow "${workflowId}" not found.`);
    return;
  }
  const records = store.getExecutions(workflowId, limit);
  if (records.length === 0) {
    console.log(`No execution history for "${wf.name}".`);
    return;
  }
  console.log(`\nExecution history for "${wf.name}":\n`);
  console.log(
    `${"ID".padEnd(12)}${"Status".padEnd(14)}${"Duration".padEnd(12)}${"Trigger".padEnd(14)}Started`,
  );
  console.log("-".repeat(75));
  for (const r of records) {
    const id = r.id.slice(0, 10).padEnd(12);
    const status = r.status.padEnd(14);
    const dur = r.durationMs
      ? `${String(r.durationMs)}ms`.padEnd(12)
      : "—".padEnd(12);
    const trigger = r.triggeredBy.padEnd(14);
    console.log(`${id}${status}${dur}${trigger}${r.startedAt}`);
  }
  console.log(`\n${String(records.length)} execution(s) shown.`);
}
