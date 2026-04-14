import { z } from "zod";

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(256).optional(),
  trigger: z.object({
    type: z.enum(["cron", "webhook", "chat_keyword"]),
    value: z.string().min(1),
    timezone: z.string().optional(),
  }),
  steps: z.array(z.unknown()).min(1).max(20),
  oneShot: z.boolean().optional(),
});

export const manageWorkflowSchema = z.object({
  action: z.enum(["list", "enable", "disable", "delete", "history"]),
  workflowId: z.string().optional(),
  workflowName: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const runWorkflowSchema = z.object({
  workflowId: z.string().optional(),
  workflowName: z.string().optional(),
});
