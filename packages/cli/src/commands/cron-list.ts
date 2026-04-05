import type { TaskStore } from "@closeclaw/ai-agent";

export function runCronList(store: TaskStore): void {
  const tasks = store.listTasks();
  if (tasks.length === 0) {
    console.log("No scheduled tasks.");
    return;
  }
  console.log(
    `\n${"ID".padEnd(12)}${"Name".padEnd(25)}${"Type".padEnd(8)}${"Status".padEnd(12)}${"Runs".padEnd(6)}Schedule`,
  );
  console.log("-".repeat(80));
  for (const t of tasks) {
    const id = t.id.slice(0, 10).padEnd(12);
    const name = t.name.slice(0, 23).padEnd(25);
    const type = t.scheduleType.padEnd(8);
    const status = t.status.padEnd(12);
    const runs = String(t.runCount).padEnd(6);
    console.log(`${id}${name}${type}${status}${runs}${t.scheduleValue}`);
  }
  console.log(`\n${String(tasks.length)} task(s) total.`);
}
