import type { StepNode, StepOutputContext, StepResult } from "./types.js";
import { executeStep, type StepExecutorDeps } from "./step-executor.js";
import { MAX_PARALLEL_BRANCHES } from "./resource-limits.js";

export async function executeParallel(
  branches: StepNode[][],
  deps: StepExecutorDeps,
  context: StepOutputContext,
): Promise<StepResult[]> {
  if (branches.length > MAX_PARALLEL_BRANCHES) {
    throw new Error(
      `Exceeded max parallel branches: ${String(branches.length)} > ${String(MAX_PARALLEL_BRANCHES)}`,
    );
  }
  const promises = branches.map((branch) =>
    executeBranch(branch, deps, context),
  );
  const settled = await Promise.allSettled(promises);
  return collectResults(settled, context);
}

async function executeBranch(
  steps: StepNode[],
  deps: StepExecutorDeps,
  context: StepOutputContext,
): Promise<StepResult[]> {
  const results: StepResult[] = [];
  for (const step of steps) {
    if (step.type !== "action") continue;
    const result = await executeStep(step, deps, context);
    results.push(result);
    if (result.status === "success" && result.output) {
      context[step.id] = result.output;
    }
  }
  return results;
}

function collectResults(
  settled: PromiseSettledResult<StepResult[]>[],
  _context: StepOutputContext,
): StepResult[] {
  const all: StepResult[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      all.push(...result.value);
    } else {
      all.push(buildFailedResult(result.reason));
    }
  }
  return all;
}

function buildFailedResult(reason: unknown): StepResult {
  const error = reason instanceof Error ? reason.message : String(reason);
  return {
    stepId: "parallel-branch",
    stepLabel: "Parallel branch",
    status: "failed",
    error,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 0,
  };
}
