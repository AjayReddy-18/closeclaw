import { z } from "zod";
import {
  MAX_STEPS,
  MAX_PARALLEL_BRANCHES,
  MAX_LOOP_ITERATIONS,
} from "./resource-limits.js";

const stepErrorPolicy = z.enum(["stop", "continue"]);

const baseActionStep = z.object({
  id: z.string().min(1),
  type: z.literal("action"),
  label: z.string().min(1),
  prompt: z.string().min(1),
  onError: stepErrorPolicy,
  requiresApproval: z.boolean().optional(),
  approvalPrompt: z.string().optional(),
  approvalTimeoutSeconds: z.number().positive().optional(),
});

type StepNodeSchema = z.ZodType<unknown>;

function buildStepNodeSchema(): StepNodeSchema {
  const lazy: StepNodeSchema = z.lazy(() =>
    z.discriminatedUnion("type", [
      baseActionStep,
      buildConditionSchema(lazy),
      buildParallelSchema(lazy),
      buildLoopSchema(lazy),
    ]),
  );
  return lazy;
}

function buildConditionSchema(stepNode: StepNodeSchema) {
  return z.object({
    id: z.string().min(1),
    type: z.literal("condition"),
    label: z.string().min(1),
    condition: z.string().min(1),
    thenSteps: z.array(stepNode),
    elseSteps: z.array(stepNode),
  });
}

function buildParallelSchema(stepNode: StepNodeSchema) {
  return z.object({
    id: z.string().min(1),
    type: z.literal("parallel"),
    label: z.string().min(1),
    branches: z.array(z.array(stepNode)).max(MAX_PARALLEL_BRANCHES),
  });
}

function buildLoopSchema(stepNode: StepNodeSchema) {
  return z.object({
    id: z.string().min(1),
    type: z.literal("loop"),
    label: z.string().min(1),
    steps: z.array(stepNode).min(1),
    untilCondition: z.string().min(1),
    maxIterations: z.number().int().min(1).max(MAX_LOOP_ITERATIONS),
    delaySeconds: z.number().min(0),
  });
}

const stepNodeSchema = buildStepNodeSchema();

const workflowDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  ownerPlatform: z.enum(["telegram", "discord"]),
  ownerSenderId: z.string().min(1),
  trigger: z.object({
    type: z.enum(["cron", "webhook", "chat_keyword"]),
    value: z.string().min(1),
    timezone: z.string().optional(),
    webhookSecret: z.string().optional(),
  }),
  steps: z.array(stepNodeSchema).min(1).max(MAX_STEPS),
  status: z.enum(["active", "disabled", "draft"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastRunAt: z.string().optional(),
  runCount: z.number().int().min(0),
});

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateWorkflowDefinition(input: unknown): ValidationResult {
  const result = workflowDefinitionSchema.safeParse(input);
  if (result.success) return { valid: true, errors: [] };
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`,
  );
  return { valid: false, errors };
}

export { workflowDefinitionSchema };
