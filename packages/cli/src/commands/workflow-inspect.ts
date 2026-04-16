import type { WorkflowStore } from "@closeclaw/workflow";

export function runWorkflowInspect(
  store: WorkflowStore,
  workflowId: string,
): void {
  const wf = store.getWorkflow(workflowId);
  if (!wf) {
    console.error(`Workflow "${workflowId}" not found.`);
    return;
  }
  console.log(`\n  Name:        ${wf.name}`);
  console.log(`  ID:          ${wf.id}`);
  console.log(`  Status:      ${wf.status}`);
  console.log(`  Trigger:     ${wf.trigger.type} — ${wf.trigger.value}`);
  console.log(`  Platform:    ${wf.ownerPlatform}`);
  console.log(`  Owner:       ${wf.ownerSenderId}`);
  console.log(`  Steps:       ${String(wf.steps.length)}`);
  console.log(`  Runs:        ${String(wf.runCount)}`);
  console.log(`  Created:     ${wf.createdAt}`);
  console.log(`  Updated:     ${wf.updatedAt}`);
  if (wf.lastRunAt) console.log(`  Last run:    ${wf.lastRunAt}`);
  if (wf.description) console.log(`  Description: ${wf.description}`);

  const recent = store.getExecutions(wf.id, 5);
  if (recent.length > 0) {
    console.log(
      `\n  Recent executions:\n  ${"Status".padEnd(14)}${"Duration".padEnd(12)}${"Triggered By".padEnd(14)}Started`,
    );
    console.log(`  ${"-".repeat(56)}`);
    for (const ex of recent) {
      const status = ex.status.padEnd(14);
      const dur = ex.durationMs
        ? `${String(ex.durationMs)}ms`.padEnd(12)
        : "—".padEnd(12);
      const trigger = ex.triggeredBy.padEnd(14);
      console.log(`  ${status}${dur}${trigger}${ex.startedAt}`);
    }
  }
  console.log();
}
