import type { StepOutcome, ProgressCallback } from "./types.js";

export interface ProgressReporter {
  reportStepStart(stepId: string, label: string): void;
  reportStepComplete(stepId: string, outcome: StepOutcome): void;
  buildSummary(finalStatus: string): string;
}

const STATUS_LABELS: Record<string, string> = {
  success: "Done",
  failed: "Failed",
  skipped: "Skipped",
  aborted: "Aborted",
};

export function createProgressReporter(
  totalSteps: number,
  onProgress: ProgressCallback,
): ProgressReporter {
  let currentStep = 0;
  const stepLabels = new Map<string, { index: number; label: string }>();
  const outcomes: Array<{ label: string; outcome: StepOutcome }> = [];

  return {
    reportStepStart: (stepId, label) => {
      currentStep++;
      stepLabels.set(stepId, { index: currentStep, label });
      onProgress(`[Step ${String(currentStep)}/${String(totalSteps)}: ${label}] Running...`);
    },
    reportStepComplete: (stepId, outcome) => {
      const info = stepLabels.get(stepId);
      if (!info) return;
      outcomes.push({ label: info.label, outcome });
      const tag = STATUS_LABELS[outcome] ?? outcome;
      onProgress(`[Step ${String(info.index)}/${String(totalSteps)}: ${info.label}] ${tag}`);
    },
    buildSummary: (finalStatus) =>
      buildSummaryText(finalStatus, outcomes),
  };
}

function buildSummaryText(
  finalStatus: string,
  outcomes: Array<{ label: string; outcome: StepOutcome }>,
): string {
  const total = outcomes.length;
  const succeeded = outcomes.filter((o) => o.outcome === "success").length;
  return (
    `Workflow ${finalStatus}: ${String(succeeded)}/${String(total)} steps succeeded.`
  );
}
