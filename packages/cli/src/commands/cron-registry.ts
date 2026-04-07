import { homedir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { createTaskStore, type TaskStore } from "@closeclaw/ai-agent";
import { runCronList } from "./cron-list.js";
import { runCronAdd, type CronAddOptions } from "./cron-add.js";
import { runCronRemove } from "./cron-remove.js";
import { runCronRuns } from "./cron-runs.js";

export interface CronStoreDeps {
  store: TaskStore;
}

export function createCronStoreDeps(): CronStoreDeps {
  const storePath = join(homedir(), ".closeclaw", "cron", "tasks.json");
  return { store: createTaskStore(storePath) };
}

export function registerCronCommands(
  program: Command,
  deps: CronStoreDeps,
): void {
  const cron = program.command("cron").description("Manage scheduled tasks");

  cron
    .command("list")
    .description("List all scheduled tasks")
    .action(() => runCronList(deps.store));

  cron
    .command("add")
    .description("Add a scheduled task")
    .requiredOption("--name <name>", "Task name")
    .requiredOption("--message <message>", "Task prompt")
    .option("--at <duration>", "One-shot delay (e.g. 30m)")
    .option("--every <duration>", "Recurring interval (e.g. 2h)")
    .option("--cron <expr>", "Cron expression (e.g. '0 9 * * *')")
    .option("--tz <timezone>", "Timezone for cron")
    .option("--platform <platform>", "Target platform", "telegram")
    .option("--sender-id <id>", "Target sender ID", "default")
    .action((opts: CronAddOptions & { senderId?: string }) => {
      runCronAdd(deps.store, { ...opts, senderId: opts.senderId });
    });

  cron
    .command("remove")
    .argument("<task-id>", "Task ID to remove")
    .description("Remove a scheduled task")
    .action((id: string) => runCronRemove(deps.store, id));

  cron
    .command("runs")
    .argument("<task-id>", "Task ID")
    .description("View run history for a task")
    .action((id: string) => runCronRuns(deps.store, id));
}
