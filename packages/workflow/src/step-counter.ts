import type { StepNode } from "./types.js";

export function countTopLevelSteps(steps: StepNode[]): number {
  return steps.length;
}
