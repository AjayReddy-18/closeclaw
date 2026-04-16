import type {
  WorkflowDefinition,
  ExecutionRecord,
  ExecutionStatus,
  StepNode,
  StepOutputContext,
  StepResult,
  ConditionStep,
  ParallelStep,
  LoopStep,
  ProcessMessageFn,
  ProgressCallback,
  ApprovalCallback,
} from "./types.js";
import { executeStep, type StepExecutorDeps } from "./step-executor.js";
import { evaluateCondition } from "./condition-evaluator.js";
import { createExecutionRecorder } from "./execution-recorder.js";
import { createProgressReporter } from "./progress-reporter.js";
import { countTopLevelSteps } from "./step-counter.js";
import { executeParallel } from "./parallel-executor.js";
import { executeLoop } from "./loop-executor.js";

export interface WorkflowRunnerDeps {
  processMessage: ProcessMessageFn;
  platform: string;
  senderId: string;
  onProgress?: ProgressCallback;
  approvalCallback?: ApprovalCallback;
}

interface RunContext {
  conditionUnmet: boolean;
}

const NEGATIVE_OUTPUT_PREFIXES = [
  "TASK_IN_PROGRESS:",
  "TASK_FAILED:",
];

function hasNegativeSignal(results: StepResult[]): boolean {
  return results.some((r) => {
    if (!r.output) return false;
    const trimmed = r.output.trimStart();
    return NEGATIVE_OUTPUT_PREFIXES.some((p) => trimmed.startsWith(p));
  });
}

function resolveStatus(
  failed: boolean,
  definition: WorkflowDefinition,
  runCtx: RunContext,
  stepResults: StepResult[],
): ExecutionStatus {
  if (failed) return "failed";
  if (!definition.retireOnSuccess) return "completed";
  if (runCtx.conditionUnmet) return "condition_unmet";
  if (hasNegativeSignal(stepResults)) return "condition_unmet";
  return "completed";
}

export async function runWorkflow(
  definition: WorkflowDefinition,
  deps: WorkflowRunnerDeps,
  triggerPayload?: Record<string, unknown>,
): Promise<ExecutionRecord> {
  const totalSteps = countTopLevelSteps(definition.steps);
  const progress = createProgressReporter(
    totalSteps,
    deps.onProgress ?? (() => {}),
  );
  const recorder = createExecutionRecorder(
    definition.id,
    definition.name,
    definition.trigger.type,
    triggerPayload,
  );
  const context: StepOutputContext = {};
  const execDeps: StepExecutorDeps = {
    processMessage: deps.processMessage,
    platform: deps.platform,
    senderId: deps.senderId,
    approvalCallback: deps.approvalCallback,
  };
  const runCtx: RunContext = { conditionUnmet: false };

  const failed = await executeStepList(
    definition.steps,
    execDeps,
    deps,
    context,
    recorder,
    progress,
    runCtx,
  );
  const status = resolveStatus(
    failed,
    definition,
    runCtx,
    recorder.getStepResults(),
  );
  return recorder.finalize(status);
}

async function executeStepList(
  steps: StepNode[],
  execDeps: StepExecutorDeps,
  runnerDeps: WorkflowRunnerDeps,
  context: StepOutputContext,
  recorder: ReturnType<typeof createExecutionRecorder>,
  progress: ReturnType<typeof createProgressReporter>,
  runCtx: RunContext,
): Promise<boolean> {
  for (const step of steps) {
    const failed = await dispatchStep(
      step,
      execDeps,
      runnerDeps,
      context,
      recorder,
      progress,
      runCtx,
    );
    if (failed) return true;
  }
  return false;
}

async function dispatchStep(
  step: StepNode,
  execDeps: StepExecutorDeps,
  runnerDeps: WorkflowRunnerDeps,
  context: StepOutputContext,
  recorder: ReturnType<typeof createExecutionRecorder>,
  progress: ReturnType<typeof createProgressReporter>,
  runCtx: RunContext,
): Promise<boolean> {
  if (step.type === "action") {
    return handleActionStep(step, execDeps, context, recorder, progress);
  }
  if (step.type === "condition") {
    return handleConditionStep(
      step,
      execDeps,
      runnerDeps,
      context,
      recorder,
      progress,
      runCtx,
    );
  }
  if (step.type === "parallel") {
    return handleParallelStep(step, execDeps, context, recorder);
  }
  if (step.type === "loop") {
    return handleLoopStep(step, execDeps, context, recorder);
  }
  return false;
}

async function handleActionStep(
  step: Extract<StepNode, { type: "action" }>,
  execDeps: StepExecutorDeps,
  context: StepOutputContext,
  recorder: ReturnType<typeof createExecutionRecorder>,
  progress: ReturnType<typeof createProgressReporter>,
): Promise<boolean> {
  progress.reportStepStart(step.id, step.label);
  const result = await executeStep(step, execDeps, context);
  recorder.addStepResult(result);
  progress.reportStepComplete(step.id, result.status);
  if (result.status === "success" && result.output) {
    context[step.id] = result.output;
  }
  return result.status === "failed" && step.onError === "stop";
}

async function handleConditionStep(
  step: ConditionStep,
  execDeps: StepExecutorDeps,
  runnerDeps: WorkflowRunnerDeps,
  context: StepOutputContext,
  recorder: ReturnType<typeof createExecutionRecorder>,
  progress: ReturnType<typeof createProgressReporter>,
  runCtx: RunContext,
): Promise<boolean> {
  const condResult = await evaluateCondition(
    step.condition,
    execDeps,
    context,
  );
  recorder.addStepResult({
    stepId: step.id,
    stepLabel: step.label,
    status: "success",
    conditionResult: condResult,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 0,
  });
  if (!condResult) {
    runCtx.conditionUnmet = true;
  }
  const branch = condResult ? step.thenSteps : step.elseSteps;
  return executeStepList(
    branch,
    execDeps,
    runnerDeps,
    context,
    recorder,
    progress,
    runCtx,
  );
}

async function handleParallelStep(
  step: ParallelStep,
  execDeps: StepExecutorDeps,
  context: StepOutputContext,
  recorder: ReturnType<typeof createExecutionRecorder>,
): Promise<boolean> {
  const results = await executeParallel(step.branches, execDeps, context);
  for (const r of results) recorder.addStepResult(r);
  return results.some((r) => r.status === "failed");
}

async function handleLoopStep(
  step: LoopStep,
  execDeps: StepExecutorDeps,
  context: StepOutputContext,
  recorder: ReturnType<typeof createExecutionRecorder>,
): Promise<boolean> {
  const results = await executeLoop(step, execDeps, context);
  for (const r of results) recorder.addStepResult(r);
  return results.some((r) => r.status === "failed");
}
