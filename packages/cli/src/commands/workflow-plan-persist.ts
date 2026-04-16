import { randomUUID } from "node:crypto";
import type { WorkflowPlan } from "@closeclaw/ai-agent";
import type { BotPlatform } from "@closeclaw/shared-types";
import {
  validateWorkflowDefinition,
  type StepNode,
  type WorkflowDefinition,
} from "@closeclaw/workflow";

type NormOk = { ok: true; step: StepNode };
type NormFail = { ok: false; errors: string[] };

function normalizeOne(raw: unknown): NormOk | NormFail {
  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: ["invalid step"] };
  }
  const o = raw as Record<string, unknown>;
  const type = o.type;
  if (type === "action") {
    const prompt = o.prompt != null ? String(o.prompt) : "";
    const onError = o.onError === "continue" ? "continue" : "stop";
    return {
      ok: true,
      step: {
        id: String(o.id ?? ""),
        type: "action",
        label: String(o.label ?? ""),
        prompt,
        onError,
        requiresApproval: Boolean(o.requiresApproval),
        approvalPrompt:
          o.approvalPrompt != null ? String(o.approvalPrompt) : undefined,
        approvalTimeoutSeconds:
          typeof o.approvalTimeoutSeconds === "number"
            ? o.approvalTimeoutSeconds
            : undefined,
      },
    };
  }
  if (type === "condition") {
    const thenRaw = o.thenSteps;
    const elseRaw = o.elseSteps;
    if (!Array.isArray(thenRaw) || !Array.isArray(elseRaw)) {
      return { ok: false, errors: ["condition needs thenSteps and elseSteps"] };
    }
    const thenN = normalizeStepsList(thenRaw);
    if (!thenN.ok) return thenN;
    const elseN = normalizeStepsList(elseRaw);
    if (!elseN.ok) return elseN;
    return {
      ok: true,
      step: {
        id: String(o.id ?? ""),
        type: "condition",
        label: String(o.label ?? ""),
        condition: String(o.condition ?? ""),
        thenSteps: thenN.steps,
        elseSteps: elseN.steps,
      },
    };
  }
  if (type === "parallel") {
    const branches = o.branches;
    if (!Array.isArray(branches)) {
      return { ok: false, errors: ["parallel needs branches"] };
    }
    const out: StepNode[][] = [];
    for (const branch of branches) {
      if (!Array.isArray(branch)) {
        return { ok: false, errors: ["parallel branch must be array"] };
      }
      const bn = normalizeStepsList(branch);
      if (!bn.ok) return bn;
      out.push(bn.steps);
    }
    return {
      ok: true,
      step: {
        id: String(o.id ?? ""),
        type: "parallel",
        label: String(o.label ?? ""),
        branches: out,
      },
    };
  }
  if (type === "loop") {
    const inner = o.steps;
    if (!Array.isArray(inner)) {
      return { ok: false, errors: ["loop needs steps"] };
    }
    const sn = normalizeStepsList(inner);
    if (!sn.ok) return sn;
    const maxIt =
      typeof o.maxIterations === "number" ? o.maxIterations : 10;
    const delay =
      typeof o.delaySeconds === "number" ? o.delaySeconds : 0;
    return {
      ok: true,
      step: {
        id: String(o.id ?? ""),
        type: "loop",
        label: String(o.label ?? ""),
        steps: sn.steps,
        untilCondition: String(o.untilCondition ?? ""),
        maxIterations: maxIt,
        delaySeconds: delay,
      },
    };
  }
  return { ok: false, errors: [`unknown step type: ${String(type)}`] };
}

function normalizeStepsList(
  raw: unknown[],
): { ok: true; steps: StepNode[] } | NormFail {
  const steps: StepNode[] = [];
  for (const item of raw) {
    const n = normalizeOne(item);
    if (!n.ok) return n;
    steps.push(n.step);
  }
  return { ok: true, steps };
}

export function planToWorkflowDefinition(
  plan: WorkflowPlan,
  ownerPlatform: BotPlatform,
  ownerSenderId: string,
):
  | { ok: true; definition: WorkflowDefinition }
  | { ok: false; errors: string[] } {
  const stepsRes = normalizeStepsList(plan.steps as unknown[]);
  if (!stepsRes.ok) return stepsRes;
  const now = new Date().toISOString();
  const definition: WorkflowDefinition = {
    id: randomUUID(),
    name: plan.name,
    description: plan.description,
    ownerPlatform,
    ownerSenderId,
    trigger: {
      type: plan.trigger.type,
      value: plan.trigger.value,
      timezone: plan.trigger.timezone,
    },
    steps: stepsRes.steps,
    status: "active",
    createdAt: now,
    updatedAt: now,
    runCount: 0,
    ...(plan.maxRuns != null ? { maxRuns: plan.maxRuns } : {}),
    ...(plan.retireOnSuccess ? { retireOnSuccess: true } : {}),
  };
  const v = validateWorkflowDefinition(definition);
  if (!v.valid) return { ok: false, errors: v.errors };
  return { ok: true, definition };
}
