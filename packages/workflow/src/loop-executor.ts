import type {
  LoopStep,
  StepOutputContext,
  StepResult,
} from "./types.js";
import { executeStep, type StepExecutorDeps } from "./step-executor.js";
import { evaluateCondition } from "./condition-evaluator.js";

export async function executeLoop(
  loop: LoopStep,
  deps: StepExecutorDeps,
  context: StepOutputContext,
): Promise<StepResult[]> {
  const allResults: StepResult[] = [];
  for (let iteration = 1; iteration <= loop.maxIterations; iteration++) {
    const iterResults = await runIteration(loop, deps, context, iteration);
    allResults.push(...iterResults);
    const conditionMet = await evaluateCondition(
      loop.untilCondition,
      deps,
      context,
    );
    if (conditionMet) break;
    if (loop.delaySeconds > 0 && iteration < loop.maxIterations) {
      await delay(loop.delaySeconds * 1000);
    }
  }
  return allResults;
}

async function runIteration(
  loop: LoopStep,
  deps: StepExecutorDeps,
  context: StepOutputContext,
  iteration: number,
): Promise<StepResult[]> {
  const results: StepResult[] = [];
  for (const step of loop.steps) {
    if (step.type !== "action") continue;
    const result = await executeStep(step, deps, context);
    result.loopIteration = iteration;
    results.push(result);
    if (result.status === "success" && result.output) {
      context[step.id] = result.output;
    }
  }
  return results;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
