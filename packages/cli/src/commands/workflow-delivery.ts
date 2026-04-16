import type { BotAdapter } from "@closeclaw/bot-adapters";
import {
  runWorkflow,
  type WorkflowDefinition,
  type ExecutionRecord,
  type WorkflowStore,
} from "@closeclaw/workflow";

export interface WorkflowProcessor {
  processMessage(
    platform: string,
    senderId: string,
    text: string,
    senderDisplayName?: string,
  ): Promise<string>;
}

export function pickAdapter(
  adapters: BotAdapter[],
  platform: string,
): BotAdapter | undefined {
  return adapters.find((a) => a.platform === platform) ?? adapters[0];
}

export function shouldNotifyWorkflowOutcome(
  triggerType: WorkflowDefinition["trigger"]["type"],
  status: ExecutionRecord["status"],
): boolean {
  if (status === "condition_unmet") return false;
  if (status !== "completed") return true;
  return triggerType !== "cron";
}

export function shouldRetire(
  workflow: WorkflowDefinition,
  status: ExecutionRecord["status"],
  newRunCount: number,
): boolean {
  if (workflow.retireOnSuccess && status === "completed") return true;
  if (workflow.maxRuns != null && newRunCount >= workflow.maxRuns) return true;
  return false;
}

export interface ExecutionCallbacks {
  onDisarm?: (workflowId: string) => void;
}

export async function executeWorkflowAndNotify(
  runningExecutions: Map<string, ExecutionRecord>,
  workflow: WorkflowDefinition,
  processor: WorkflowProcessor,
  adapters: BotAdapter[],
  store: WorkflowStore,
  triggerPayload?: Record<string, unknown>,
  callbacks?: ExecutionCallbacks,
): Promise<void> {
  const fresh = store.getWorkflow(workflow.id);
  if (fresh && fresh.status !== "active") {
    callbacks?.onDisarm?.(workflow.id);
    return;
  }
  const trackingId = `${workflow.id}-${Date.now()}`;
  const placeholder: ExecutionRecord = {
    id: trackingId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    triggeredBy: workflow.trigger.type,
    triggerPayload,
    status: "running",
    startedAt: new Date().toISOString(),
    stepResults: [],
  };
  runningExecutions.set(trackingId, placeholder);
  try {
    const record = await runWorkflow(
      workflow,
      {
        processMessage: (platform, senderId, text) =>
          processor.processMessage(platform, senderId, text),
        platform: workflow.ownerPlatform,
        senderId: workflow.ownerSenderId,
      },
      triggerPayload,
    );
    runningExecutions.delete(trackingId);
    store.addExecution(record);
    const current = store.getWorkflow(workflow.id);
    const newRunCount = current ? current.runCount + 1 : 1;
    if (current) {
      store.updateWorkflow(workflow.id, {
        runCount: newRunCount,
        lastRunAt: new Date().toISOString(),
      });
    }
    const retired = shouldRetire(workflow, record.status, newRunCount);
    if (retired && current) {
      store.updateWorkflow(workflow.id, { status: "disabled" });
      callbacks?.onDisarm?.(workflow.id);
    }
    if (!shouldNotifyWorkflowOutcome(workflow.trigger.type, record.status)) {
      if (retired) {
        notifyRetired(adapters, workflow, record.status);
      }
      return;
    }
    const adapter = pickAdapter(adapters, workflow.ownerPlatform);
    if (!adapter) return;
    const parts = [`Workflow **${workflow.name}** ${record.status}.`];
    if (retired) {
      parts.push("Auto-disabled — goal achieved.");
    }
    const failedSteps = record.stepResults.filter(
      (s) => s.status === "failed",
    );
    if (failedSteps.length > 0) {
      const labels = failedSteps.map((s) => s.stepLabel).join(", ");
      parts.push(`Failed steps: ${labels}`);
    }
    await adapter.sendMessage(workflow.ownerSenderId, parts.join("\n"));
  } catch {
    runningExecutions.delete(trackingId);
  }
}

function notifyRetired(
  adapters: BotAdapter[],
  workflow: WorkflowDefinition,
  status: string,
): void {
  const adapter = pickAdapter(adapters, workflow.ownerPlatform);
  if (!adapter) return;
  const reason =
    status === "completed"
      ? "completed successfully"
      : "reached its run limit";
  const msg = `Workflow **${workflow.name}** ${reason} and has been auto-disabled.`;
  adapter.sendMessage(workflow.ownerSenderId, msg).catch(() => {});
}
