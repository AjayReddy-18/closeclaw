import type {
  ActionStep,
  StepOutputContext,
  StepResult,
  ProcessMessageFn,
} from "./types.js";
import { interpolateOutputs } from "./output-interpolator.js";

export interface StepExecutorDeps {
  processMessage: ProcessMessageFn;
  platform: string;
  senderId: string;
}

export async function executeStep(
  step: ActionStep,
  deps: StepExecutorDeps,
  context: StepOutputContext,
): Promise<StepResult> {
  const startedAt = new Date().toISOString();
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

function buildResult(
  step: ActionStep,
  startedAt: string,
  status: "success" | "failed",
  output?: string,
  error?: string,
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
    startedAt,
    completedAt,
    durationMs,
  };
}
