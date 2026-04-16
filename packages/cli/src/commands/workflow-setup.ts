import { homedir } from "node:os";
import { join } from "node:path";
import {
  createWorkflowStore,
  type WorkflowStore,
  type WorkflowDefinition,
} from "@closeclaw/workflow";
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
  runWorkflow: (workflow: {
    id: string;
    status: string;
    trigger: { type: string; value: string };
  }) => Promise<void>;
  runWorkflowDefinition: (workflow: WorkflowDefinition) => Promise<void>;
}

export function setupWorkflowSystem(
  executeFn: WorkflowRunnerFn,
): WorkflowAssembly {
  const baseDir = join(homedir(), ".closeclaw", "workflows");
  const store = createWorkflowStore(baseDir);
  const scheduler = createWorkflowScheduler(async (workflow) => {
    await executeFn(workflow);
  });
  const planRef: WorkflowPlanRef = { plan: null };
  const tools: Record<string, unknown> = {
    create_workflow: createWorkflowTool(planRef),
  };
  const placeholder: WorkflowAssembly["runWorkflow"] = async () => {
    throw new Error("Workflow executor not yet wired");
  };
  const placeholderDef: WorkflowAssembly["runWorkflowDefinition"] =
    async () => {
      throw new Error("Workflow executor not yet wired");
    };
  return {
    store,
    scheduler,
    planRef,
    tools,
    runWorkflow: placeholder,
    runWorkflowDefinition: placeholderDef,
  };
}
