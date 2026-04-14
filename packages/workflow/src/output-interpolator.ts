import type { StepOutputContext } from "./types.js";

const TEMPLATE_PATTERN = /\{\{([a-zA-Z0-9_-]+)\.output\}\}/g;

export function interpolateOutputs(
  text: string,
  context: StepOutputContext,
): string {
  return text.replace(TEMPLATE_PATTERN, (match, stepId: string) => {
    const value = context[stepId];
    return value !== undefined ? value : match;
  });
}
