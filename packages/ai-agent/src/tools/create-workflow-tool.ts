import { z } from "zod";
import { tool } from "ai";

const MAX_WORKFLOW_STEPS = 20;

const stepSchema = z.object({
  id: z.string().min(1).describe("Unique step identifier"),
  type: z.enum(["action", "condition", "parallel", "loop"]),
  label: z.string().min(1).describe("Human-readable step name"),
  prompt: z.string().optional().describe("Prompt for action steps"),
  onError: z.enum(["stop", "continue"]).optional(),
  requiresApproval: z.boolean().optional(),
  approvalPrompt: z.string().optional(),
  condition: z.string().optional(),
  thenSteps: z.array(z.unknown()).optional(),
  elseSteps: z.array(z.unknown()).optional(),
  branches: z.array(z.array(z.unknown())).optional(),
  steps: z.array(z.unknown()).optional(),
  untilCondition: z.string().optional(),
  maxIterations: z.number().optional(),
  delaySeconds: z.number().optional(),
});

export const workflowToolSchema = z.object({
  name: z.string().min(1).max(64).describe("Workflow name"),
  description: z.string().max(256).optional(),
  trigger: z.object({
    type: z.enum(["cron", "webhook", "chat_keyword"]),
    value: z.string().min(1),
    timezone: z.string().optional(),
  }),
  steps: z
    .array(stepSchema)
    .min(1)
    .max(MAX_WORKFLOW_STEPS)
    .describe("Workflow steps"),
  oneShot: z.boolean().optional().describe("Run once without saving"),
});

export type WorkflowPlan = z.infer<typeof workflowToolSchema>;

export interface WorkflowPlanRef {
  plan: WorkflowPlan | null;
}

export function createWorkflowTool(planRef: WorkflowPlanRef) {
  return tool({
    description:
      "Create a workflow from a user's request. Define the trigger, " +
      "steps, and flow. For one-shot workflows set oneShot=true. " +
      "For reusable workflows, provide a cron/webhook/chat_keyword trigger.",
    inputSchema: workflowToolSchema,
    execute: async (params) => {
      planRef.plan = params;
      return { workflow: params.name, steps: params.steps.length };
    },
  });
}
