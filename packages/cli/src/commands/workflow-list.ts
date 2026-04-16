import type { WorkflowStore } from "@closeclaw/workflow";

export function runWorkflowList(store: WorkflowStore): void {
  const workflows = store.listAll();
  if (workflows.length === 0) {
    console.log("No workflows defined.");
    return;
  }
  console.log(
    `\n${"ID".padEnd(12)}${"Name".padEnd(25)}${"Trigger".padEnd(14)}${"Status".padEnd(10)}${"Runs".padEnd(6)}Created`,
  );
  console.log("-".repeat(90));
  for (const wf of workflows) {
    const id = wf.id.slice(0, 10).padEnd(12);
    const name = wf.name.slice(0, 23).padEnd(25);
    const trigger = `${wf.trigger.type}`.padEnd(14);
    const status = wf.status.padEnd(10);
    const runs = String(wf.runCount).padEnd(6);
    const created = new Date(wf.createdAt).toLocaleDateString();
    console.log(`${id}${name}${trigger}${status}${runs}${created}`);
  }
  console.log(`\n${String(workflows.length)} workflow(s) total.`);
}
