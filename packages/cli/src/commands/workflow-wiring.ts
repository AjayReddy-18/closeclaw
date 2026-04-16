import {
  type createMessageProcessor,
  createManageWorkflowTool,
} from "@closeclaw/ai-agent";
import type { BotPlatform } from "@closeclaw/shared-types";
import type { BotAdapter } from "@closeclaw/bot-adapters";
import type { WorkflowPlanCallbacks } from "@closeclaw/gateway";
import { type WorkflowDefinition, type ExecutionRecord } from "@closeclaw/workflow";
import {
  setupWorkflowSystem,
  type WorkflowAssembly,
} from "./workflow-setup.js";
import { planToWorkflowDefinition } from "./workflow-plan-persist.js";
import { executeWorkflowAndNotify } from "./workflow-delivery.js";

const runningExecutions = new Map<string, ExecutionRecord>();

export function createWorkflowPlanHandlers(
  assembly: WorkflowAssembly,
  senderRef: { platform: string; senderId: string },
  adapters: BotAdapter[],
): WorkflowPlanCallbacks {
  const pf = senderRef.platform as BotPlatform;
  return {
    onSave: async (plan) => {
      if (!senderRef.senderId) return;
      const built = planToWorkflowDefinition(plan, pf, senderRef.senderId);
      if (!built.ok) {
        await sendWorkflowError(adapters, pf, senderRef.senderId, built.errors);
        return;
      }
      assembly.store.saveWorkflow(built.definition);
      assembly.scheduler.armWorkflow(built.definition);
    },
    onOneShot: async (plan) => {
      if (!senderRef.senderId) return;
      const built = planToWorkflowDefinition(plan, pf, senderRef.senderId);
      if (!built.ok) return;
      await assembly.runWorkflowDefinition(built.definition);
    },
  };
}

async function sendWorkflowError(
  adapters: BotAdapter[],
  platform: BotPlatform,
  senderId: string,
  errors: string[],
): Promise<void> {
  const adapter = adapters.find((a) => a.platform === platform) ?? adapters[0];
  if (!adapter) return;
  const text = `Workflow not saved:\n${errors.join("\n")}`;
  await adapter.sendMessage(senderId, text).catch(() => {});
}

export function initWorkflowSystem(senderRef: {
  platform: string;
  senderId: string;
}): WorkflowAssembly {
  const assembly = setupWorkflowSystem(async () => {
    throw new Error("Workflow executor not yet wired");
  });
  assembly.tools.manage_workflow = buildLazyManageTool(assembly, senderRef);
  return assembly;
}

function buildLazyManageTool(
  assembly: WorkflowAssembly,
  senderRef: { platform: string; senderId: string },
) {
  const lazyStore = {
    listWorkflows: (_p: string, _s: string) =>
      assembly.store.listWorkflows(senderRef.platform, senderRef.senderId),
    getWorkflow: (id: string) => assembly.store.getWorkflow(id),
    updateWorkflow: (id: string, u: Record<string, unknown>) =>
      assembly.store.updateWorkflow(id, u),
    deleteWorkflow: (id: string) => assembly.store.deleteWorkflow(id),
    getExecutions: (wfId: string, limit?: number) =>
      assembly.store.getExecutions(wfId, limit),
  };
  return createManageWorkflowTool(lazyStore, "", "");
}

export function wireWorkflowExecutor(
  assembly: WorkflowAssembly,
  processor: ReturnType<typeof createMessageProcessor>,
  adapters: BotAdapter[],
): void {
  assembly.scheduler.stop();
  const runner = async (
    workflow: WorkflowDefinition,
    triggerPayload?: Record<string, unknown>,
  ) => {
    await executeWorkflowAndNotify(
      runningExecutions,
      workflow,
      processor,
      adapters,
      assembly.store,
      triggerPayload,
      { onDisarm: (id) => assembly.scheduler.disarmWorkflow(id) },
    );
  };
  const newAssembly = setupWorkflowSystem(runner);
  Object.assign(assembly.scheduler, newAssembly.scheduler);
  assembly.runWorkflow = async (wf) => {
    const full = assembly.store.getWorkflow(wf.id);
    if (full) await runner(full);
  };
  assembly.runWorkflowDefinition = (def) => runner(def);
  startSchedulerWithStore(assembly, newAssembly);
}

export function markRunningAsInterrupted(
  store: WorkflowAssembly["store"],
): void {
  for (const [id, record] of runningExecutions) {
    record.status = "interrupted";
    record.completedAt = new Date().toISOString();
    record.durationMs =
      new Date(record.completedAt).getTime() -
      new Date(record.startedAt).getTime();
    store.addExecution(record);
    runningExecutions.delete(id);
  }
}

function startSchedulerWithStore(
  orig: WorkflowAssembly,
  wired: WorkflowAssembly,
): void {
  const all = orig.store
    .listAll()
    .filter((w) => w.status === "active" && w.trigger.type === "cron");
  if (all.length > 0) {
    wired.scheduler.start(all);
    console.log(`[workflow] ${String(all.length)} cron workflows armed`);
  }
}

