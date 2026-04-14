import type { WorkflowDefinition, ExecutionRecord } from "@closeclaw/workflow";

export type WorkflowRunnerFn = (
  workflow: WorkflowDefinition,
  triggerPayload?: Record<string, unknown>,
) => Promise<ExecutionRecord>;
