import { homedir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { createWorkflowStore, type WorkflowStore } from "@closeclaw/workflow";
import { runWorkflowList } from "./workflow-list.js";
import { runWorkflowInspect } from "./workflow-inspect.js";
import { runWorkflowEnable } from "./workflow-enable.js";
import { runWorkflowDisable } from "./workflow-disable.js";
import { runWorkflowDelete } from "./workflow-delete.js";
import { runWorkflowHistory } from "./workflow-history.js";

export interface WorkflowStoreDeps {
  store: WorkflowStore;
}

export function createWorkflowStoreDeps(): WorkflowStoreDeps {
  const baseDir = join(homedir(), ".closeclaw", "workflows");
  return { store: createWorkflowStore(baseDir) };
}

export function resolveWorkflowId(
  store: WorkflowStore,
  partial: string,
): string | undefined {
  const exact = store.getWorkflow(partial);
  if (exact) return partial;
  const matches = store.listAll().filter((w) => w.id.startsWith(partial));
  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) {
    console.error(
      `Ambiguous ID "${partial}" matches ${String(matches.length)} workflows. Be more specific.`,
    );
    return undefined;
  }
  console.error(`Workflow "${partial}" not found.`);
  return undefined;
}

function withResolvedId(
  store: WorkflowStore,
  partial: string,
  fn: (id: string) => void,
): void {
  const id = resolveWorkflowId(store, partial);
  if (id) fn(id);
}

export function registerWorkflowCommands(
  program: Command,
  deps: WorkflowStoreDeps,
): void {
  const wf = program.command("workflow").description("Manage workflows");

  wf.command("list")
    .description("List all saved workflows")
    .action(() => runWorkflowList(deps.store));

  wf.command("inspect")
    .argument("<workflow-id>", "Workflow ID (or prefix)")
    .description("Show workflow definition and recent history")
    .action((id: string) =>
      withResolvedId(deps.store, id, (full) =>
        runWorkflowInspect(deps.store, full),
      ),
    );

  wf.command("enable")
    .argument("<workflow-id>", "Workflow ID (or prefix)")
    .description("Enable a workflow")
    .action((id: string) =>
      withResolvedId(deps.store, id, (full) =>
        runWorkflowEnable(deps.store, full),
      ),
    );

  wf.command("disable")
    .argument("<workflow-id>", "Workflow ID (or prefix)")
    .description("Disable a workflow")
    .action((id: string) =>
      withResolvedId(deps.store, id, (full) =>
        runWorkflowDisable(deps.store, full),
      ),
    );

  wf.command("delete")
    .argument("<workflow-id>", "Workflow ID (or prefix)")
    .description("Delete a workflow")
    .action((id: string) =>
      withResolvedId(deps.store, id, (full) =>
        runWorkflowDelete(deps.store, full),
      ),
    );

  wf.command("history")
    .argument("<workflow-id>", "Workflow ID (or prefix)")
    .description("Show execution history for a workflow")
    .option("-n, --limit <count>", "Number of records to show", "20")
    .action((id: string, opts: { limit: string }) =>
      withResolvedId(deps.store, id, (full) =>
        runWorkflowHistory(deps.store, full, Number.parseInt(opts.limit, 10)),
      ),
    );
}
