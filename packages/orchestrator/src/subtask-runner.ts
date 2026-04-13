import type { LiveMessage } from "@closeclaw/bot-adapters";
import type { SubtaskPlan, SubtaskResult, SubtaskRunnerDeps } from "./types.js";

function buildFulfilledResult(
  plan: SubtaskPlan,
  response: string,
): SubtaskResult {
  return {
    id: plan.id,
    label: plan.label,
    status: "fulfilled",
    response,
  };
}

function buildRejectedResult(plan: SubtaskPlan, error: unknown): SubtaskResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    id: plan.id,
    label: plan.label,
    status: "rejected",
    error: message,
  };
}

function formatLabel(label: string, text: string): string {
  return `[${label}] ${text}`;
}

export function createSubtaskRunner(
  plan: SubtaskPlan,
  live: LiveMessage,
  deps: SubtaskRunnerDeps,
): () => Promise<SubtaskResult> {
  return async () => {
    live.update(formatLabel(plan.label, "Starting..."));
    try {
      const response = await deps.processMessage(
        deps.platform,
        deps.senderId,
        plan.prompt,
        deps.senderDisplayName,
        async (text) => live.update(formatLabel(plan.label, text)),
      );
      await live.finalize(formatLabel(plan.label, response));
      return buildFulfilledResult(plan, response);
    } catch (error) {
      const result = buildRejectedResult(plan, error);
      await live.finalize(formatLabel(plan.label, `Error: ${result.error}`));
      return result;
    }
  };
}
