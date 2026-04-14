import type { BotAdapter } from "@closeclaw/bot-adapters";

export interface WorkflowPlanRef {
  plan: {
    name: string;
    trigger: { type: string; value: string; timezone?: string };
    steps: unknown[];
    oneShot?: boolean;
    description?: string;
  } | null;
}

export interface WorkflowPlanCallbacks {
  onSave: (plan: NonNullable<WorkflowPlanRef["plan"]>) => Promise<void>;
  onOneShot: (plan: NonNullable<WorkflowPlanRef["plan"]>) => Promise<void>;
}

export function hasWorkflowPlan(ref?: WorkflowPlanRef): boolean {
  return ref?.plan !== null && ref?.plan !== undefined;
}

export async function handleWorkflowPlan(
  ref: WorkflowPlanRef,
  adapter: BotAdapter,
  senderId: string,
  callbacks?: WorkflowPlanCallbacks,
): Promise<boolean> {
  if (!ref.plan) return false;
  const plan = ref.plan;
  ref.plan = null;
  if (plan.oneShot && callbacks?.onOneShot) {
    await callbacks.onOneShot(plan);
    return true;
  }
  if (callbacks?.onSave) {
    await confirmAndSave(plan, adapter, senderId, callbacks.onSave);
    return true;
  }
  return false;
}

async function confirmAndSave(
  plan: NonNullable<WorkflowPlanRef["plan"]>,
  adapter: BotAdapter,
  senderId: string,
  onSave: (plan: NonNullable<WorkflowPlanRef["plan"]>) => Promise<void>,
): Promise<void> {
  const summary = formatPlanSummary(plan);
  await adapter.sendMessage(senderId, summary);
  await onSave(plan);
}

function formatPlanSummary(
  plan: NonNullable<WorkflowPlanRef["plan"]>,
): string {
  const steps = plan.steps.length;
  return (
    `**Workflow: ${plan.name}**\n` +
    `Trigger: ${plan.trigger.type} (${plan.trigger.value})\n` +
    `Steps: ${String(steps)}\n` +
    `Saving workflow...`
  );
}
