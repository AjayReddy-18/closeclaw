import { z } from "zod";
import { tool } from "ai";

const MIN_TASKS = 2;
const MAX_TASKS = 5;

const taskSchema = z.object({
  label: z
    .string()
    .describe("Short human-readable description of this subtask"),
  prompt: z.string().describe("Full self-contained prompt for this subtask"),
});

export const parallelTasksSchema = z.object({
  tasks: z
    .array(taskSchema)
    .min(MIN_TASKS)
    .max(MAX_TASKS)
    .describe("Independent subtasks to execute in parallel"),
});

export type ParallelTasksPlan = z.infer<typeof parallelTasksSchema>;

export interface OrchestrationPlanRef {
  plan: ParallelTasksPlan | null;
}

export function createParallelTasksTool(planRef?: OrchestrationPlanRef) {
  return tool({
    description:
      "Decompose a complex user request into 2-5 independent subtasks " +
      "for parallel execution. Each subtask prompt must be self-contained. " +
      "Only use when the request has multiple clearly independent parts.",
    inputSchema: parallelTasksSchema,
    execute: async (params) => {
      if (planRef) planRef.plan = params;
      return params.tasks;
    },
  });
}
