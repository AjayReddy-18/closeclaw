import type { OrchestrationSession, OrchestrationDeps, SubtaskResult } from "./types.js";
import { createSubtaskRunner } from "./subtask-runner.js";
import { buildOrchestrationSummary } from "./summary-builder.js";

function collectResults(
  settled: PromiseSettledResult<SubtaskResult>[],
): SubtaskResult[] {
  return settled.map((entry) =>
    entry.status === "fulfilled"
      ? entry.value
      : {
          id: "unknown",
          label: "Unknown",
          status: "rejected" as const,
          error: String(entry.reason),
        },
  );
}

export async function runOrchestration(
  session: OrchestrationSession,
  deps: OrchestrationDeps,
): Promise<string> {
  const liveMessages = session.subtasks.map(() => deps.createLiveMessage());

  const runners = session.subtasks.map((plan, index) =>
    createSubtaskRunner(plan, liveMessages[index], {
      processMessage: deps.processMessage,
      platform: session.platform,
      senderId: session.senderId,
      senderDisplayName: session.senderDisplayName,
    }),
  );

  const settled = await Promise.allSettled(runners.map((run) => run()));
  const results = collectResults(settled);
  const summary = buildOrchestrationSummary(results);

  await deps.sendSummary(summary);
  for (const live of liveMessages) live.dispose();

  return summary;
}
