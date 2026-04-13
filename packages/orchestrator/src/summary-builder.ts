import type { SubtaskResult } from "./types.js";

const MAX_RESULT_LENGTH = 300;
const SUCCESS_INDICATOR = "\u2705";
const FAILURE_INDICATOR = "\u274C";

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

function formatSuccessEntry(result: SubtaskResult): string {
  const text = truncateText(
    result.response ?? "No response",
    MAX_RESULT_LENGTH,
  );
  return `${SUCCESS_INDICATOR} ${result.label}\n${text}`;
}

function formatFailureEntry(result: SubtaskResult): string {
  return `${FAILURE_INDICATOR} ${result.label}\n${result.error ?? "Unknown error"}`;
}

function formatResultEntry(result: SubtaskResult): string {
  return result.status === "fulfilled"
    ? formatSuccessEntry(result)
    : formatFailureEntry(result);
}

function buildHeader(results: SubtaskResult[]): string {
  const total = results.length;
  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = total - succeeded;
  if (failed === 0) return `All ${total} tasks completed successfully.`;
  if (succeeded === 0) return `All ${total} tasks failed.`;
  return `${succeeded} of ${total} tasks succeeded, ${failed} failed.`;
}

export function buildOrchestrationSummary(results: SubtaskResult[]): string {
  if (results.length === 0) return "No tasks were executed.";
  const header = buildHeader(results);
  const entries = results.map(formatResultEntry).join("\n\n");
  return `${header}\n\n${entries}`;
}
