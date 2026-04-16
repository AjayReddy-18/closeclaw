import type {
  ActionStep,
  StepOutputContext,
  StepResult,
  ProcessMessageFn,
  ApprovalCallback,
  ApprovalDecision,
} from "./types.js";
import { interpolateOutputs } from "./output-interpolator.js";
import { requestApproval } from "./approval-handler.js";
import { DEFAULT_APPROVAL_TIMEOUT_SECONDS } from "./resource-limits.js";

export interface StepExecutorDeps {
  processMessage: ProcessMessageFn;
  platform: string;
  senderId: string;
  approvalCallback?: ApprovalCallback;
}

export async function executeStep(
  step: ActionStep,
  deps: StepExecutorDeps,
  context: StepOutputContext,
): Promise<StepResult> {
  const startedAt = new Date().toISOString();
  if (step.requiresApproval && deps.approvalCallback) {
    const decision = await requestApprovalWithTimeout(
      step,
      deps.approvalCallback,
    );
    if (decision !== "approved") {
      return buildResult(
        step,
        startedAt,
        "skipped",
        undefined,
        `Approval ${decision}`,
        decision,
      );
    }
  }
  const interpolatedPrompt = interpolateOutputs(step.prompt, context);
  try {
    const output = await deps.processMessage(
      deps.platform,
      deps.senderId,
      interpolatedPrompt,
    );
    return buildResult(step, startedAt, "success", output);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return buildResult(step, startedAt, "failed", undefined, message);
  }
}

async function requestApprovalWithTimeout(
  step: ActionStep,
  callback: ApprovalCallback,
): Promise<ApprovalDecision> {
  const prompt = step.approvalPrompt ?? `Approve step "${step.label}"?`;
  const timeoutMs =
    (step.approvalTimeoutSeconds ?? DEFAULT_APPROVAL_TIMEOUT_SECONDS) * 1000;
  return Promise.race([
    requestApproval(prompt, callback),
    new Promise<ApprovalDecision>((resolve) =>
      setTimeout(() => resolve("timeout"), timeoutMs),
    ),
  ]);
}

function buildResult(
  step: ActionStep,
  startedAt: string,
  status: "success" | "failed" | "skipped",
  output?: string,
  error?: string,
  approvalDecision?: ApprovalDecision,
): StepResult {
  const completedAt = new Date().toISOString();
  const durationMs =
    new Date(completedAt).getTime() - new Date(startedAt).getTime();
  return {
    stepId: step.id,
    stepLabel: step.label,
    status,
    output,
    error,
    approvalDecision,
    startedAt,
    completedAt,
    durationMs,
  };
}
