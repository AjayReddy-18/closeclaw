import type { TaskStore } from "@closeclaw/ai-agent";

export function runCronRuns(store: TaskStore, taskId: string): void {
  const runs = store.getRunsForTask(taskId, 20);
  if (runs.length === 0) {
    console.log(`No runs for task ${taskId}.`);
    return;
  }
  console.log(
    `\n${"Ran At".padEnd(26)}${"Outcome".padEnd(10)}${"Duration".padEnd(10)}Delivered`,
  );
  console.log("-".repeat(60));
  for (const r of runs) {
    const date = new Date(r.ranAt).toLocaleString().padEnd(26);
    const outcome = r.outcome.padEnd(10);
    const dur = `${String(r.durationMs)}ms`.padEnd(10);
    console.log(`${date}${outcome}${dur}${String(r.delivered)}`);
  }
  console.log(`\n${String(runs.length)} run(s) shown.`);
}
