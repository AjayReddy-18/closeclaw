import type { StepOutputContext, ProcessMessageFn } from "./types.js";

export interface ConditionEvalDeps {
  processMessage: ProcessMessageFn;
  platform: string;
  senderId: string;
}

export async function evaluateCondition(
  condition: string,
  deps: ConditionEvalDeps,
  context: StepOutputContext,
): Promise<boolean> {
  const prompt = buildConditionPrompt(condition, context);
  try {
    const response = await deps.processMessage(
      deps.platform,
      deps.senderId,
      prompt,
    );
    return parseConditionResponse(response);
  } catch {
    return false;
  }
}

function buildConditionPrompt(
  condition: string,
  context: StepOutputContext,
): string {
  const contextLines = Object.entries(context)
    .map(([stepId, output]) => `${stepId}: ${output}`)
    .join("\n");
  const contextBlock = contextLines
    ? `\nPrevious step outputs:\n${contextLines}\n`
    : "";
  return (
    `Evaluate this condition and respond with ONLY "true" or "false".\n` +
    `Condition: ${condition}${contextBlock}`
  );
}

function parseConditionResponse(response: string): boolean {
  return response.trim().toLowerCase().startsWith("true");
}
