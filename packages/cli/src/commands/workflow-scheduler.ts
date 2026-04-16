import type { WorkflowDefinition } from "@closeclaw/workflow";
import { nextCronOccurrence } from "@closeclaw/ai-agent";

export type WorkflowExecuteFn = (workflow: WorkflowDefinition) => Promise<void>;

export interface WorkflowScheduler {
  start(workflows?: WorkflowDefinition[]): void;
  stop(): void;
  armWorkflow(workflow: WorkflowDefinition): void;
  disarmWorkflow(workflowId: string): void;
  isArmed(workflowId: string): boolean;
}

export function createWorkflowScheduler(
  onExecute: WorkflowExecuteFn,
): WorkflowScheduler {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const disarmed = new Set<string>();

  function clearTimer(workflowId: string): void {
    const timer = timers.get(workflowId);
    if (timer) clearTimeout(timer);
    timers.delete(workflowId);
  }

  function arm(workflow: WorkflowDefinition): void {
    if (workflow.trigger.type !== "cron") return;
    if (workflow.status !== "active") return;
    disarmed.delete(workflow.id);
    clearTimer(workflow.id);
    scheduleNext(workflow, onExecute, timers, disarmed);
  }

  function disarm(workflowId: string): void {
    disarmed.add(workflowId);
    clearTimer(workflowId);
  }

  return {
    start: (workflows) => workflows?.forEach(arm),
    stop: () => {
      for (const [id] of timers) disarm(id);
    },
    armWorkflow: arm,
    disarmWorkflow: disarm,
    isArmed: (id) => timers.has(id),
  };
}

function scheduleNext(
  workflow: WorkflowDefinition,
  onExecute: WorkflowExecuteFn,
  timers: Map<string, ReturnType<typeof setTimeout>>,
  disarmed: Set<string>,
): void {
  const nextRun = nextCronOccurrence(workflow.trigger.value, new Date());
  if (!nextRun) return;
  const delayMs = nextRun.getTime() - Date.now();
  const safeDelay = Math.max(delayMs, 1000);
  const timer = setTimeout(async () => {
    timers.delete(workflow.id);
    try {
      await onExecute(workflow);
    } catch (err) {
      console.error(`[workflow-scheduler] Error: ${String(err)}`);
    }
    if (disarmed.has(workflow.id)) return;
    scheduleNext(workflow, onExecute, timers, disarmed);
  }, safeDelay);
  timers.set(workflow.id, timer);
}
