import { homedir } from "node:os";
import { join } from "node:path";
import { createWorkflowStore, type WorkflowStore } from "@closeclaw/workflow";
import { createWorkflowTool, type WorkflowPlanRef } from "@closeclaw/ai-agent";
import {
  createWorkflowScheduler,
  type WorkflowScheduler,
} from "./workflow-scheduler.js";
import type { WorkflowRunnerFn } from "./workflow-runner-bridge.js";

export interface WorkflowAssembly {
  store: WorkflowStore;
  scheduler: WorkflowScheduler;
  planRef: WorkflowPlanRef;
  tools: Record<string, unknown>;
}

export function setupWorkflowSystem(
  runWorkflowFn: WorkflowRunnerFn,
): WorkflowAssembly {
  const baseDir = join(homedir(), ".closeclaw", "workflows");
  const store = createWorkflowStore(baseDir);
  const scheduler = createWorkflowScheduler(async (workflow) => {
    await runWorkflowFn(workflow);
  });
  const planRef: WorkflowPlanRef = { plan: null };
  const tools = {
    create_workflow: createWorkflowTool(planRef),
  };
  return { store, scheduler, planRef, tools };
}
