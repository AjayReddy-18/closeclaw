import type { BotPlatform } from "@closeclaw/shared-types";

export type TriggerType = "cron" | "webhook" | "chat_keyword";
export type WorkflowStatus = "active" | "disabled" | "draft";
export type StepNodeType = "action" | "condition" | "parallel" | "loop";
export type StepErrorPolicy = "stop" | "continue";
export type ExecutionStatus =
  | "running"
  | "completed"
  | "failed"
  | "aborted"
  | "interrupted";
export type StepOutcome = "success" | "failed" | "skipped" | "aborted";
export type ApprovalDecision = "approved" | "denied" | "timeout";

export interface Trigger {
  type: TriggerType;
  value: string;
  timezone?: string;
  webhookSecret?: string;
}

export interface ActionStep {
  id: string;
  type: "action";
  label: string;
  prompt: string;
  onError: StepErrorPolicy;
  requiresApproval?: boolean;
  approvalPrompt?: string;
  approvalTimeoutSeconds?: number;
}

export interface ConditionStep {
  id: string;
  type: "condition";
  label: string;
  condition: string;
  thenSteps: StepNode[];
  elseSteps: StepNode[];
}

export interface ParallelStep {
  id: string;
  type: "parallel";
  label: string;
  branches: StepNode[][];
}

export interface LoopStep {
  id: string;
  type: "loop";
  label: string;
  steps: StepNode[];
  untilCondition: string;
  maxIterations: number;
  delaySeconds: number;
}

export type StepNode = ActionStep | ConditionStep | ParallelStep | LoopStep;

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  ownerPlatform: BotPlatform;
  ownerSenderId: string;
  trigger: Trigger;
  steps: StepNode[];
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  runCount: number;
}

export interface StepResult {
  stepId: string;
  stepLabel: string;
  status: StepOutcome;
  output?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  approvalDecision?: ApprovalDecision;
  conditionResult?: boolean;
  loopIteration?: number;
}

export interface ExecutionRecord {
  id: string;
  workflowId: string;
  workflowName: string;
  triggeredBy: TriggerType;
  triggerPayload?: Record<string, unknown>;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  stepResults: StepResult[];
  abortReason?: string;
}

export type StepOutputContext = Record<string, string>;

export interface WorkflowStore {
  listWorkflows(
    ownerPlatform: BotPlatform,
    ownerSenderId: string,
  ): WorkflowDefinition[];
  getWorkflow(id: string): WorkflowDefinition | undefined;
  saveWorkflow(workflow: WorkflowDefinition): void;
  updateWorkflow(id: string, updates: Partial<WorkflowDefinition>): void;
  deleteWorkflow(id: string): boolean;
  addExecution(record: ExecutionRecord): void;
  getExecutions(workflowId: string, limit?: number): ExecutionRecord[];
}

export interface WorkflowExecutor {
  execute(
    workflow: WorkflowDefinition,
    triggerPayload?: Record<string, unknown>,
  ): Promise<ExecutionRecord>;
  abort(executionId: string): void;
}

export interface WorkflowScheduler {
  start(): void;
  stop(): void;
  armWorkflow(workflow: WorkflowDefinition): void;
  disarmWorkflow(workflowId: string): void;
}

export interface WorkflowValidator {
  validate(definition: unknown): {
    valid: boolean;
    errors: string[];
  };
}
