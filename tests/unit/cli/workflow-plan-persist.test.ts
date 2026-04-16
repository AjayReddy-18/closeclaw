import { describe, it, expect } from "vitest";
import { planToWorkflowDefinition } from "../../../packages/cli/src/commands/workflow-plan-persist.js";
import { BotPlatform } from "@closeclaw/shared-types";

describe("planToWorkflowDefinition", () => {
  it("builds a valid definition from a minimal plan", () => {
    const plan = {
      name: "test-wf",
      trigger: { type: "cron" as const, value: "0 * * * *" },
      steps: [
        {
          id: "s1",
          type: "action" as const,
          label: "Step one",
          prompt: "Do the thing",
          onError: "stop" as const,
        },
      ],
    };
    const result = planToWorkflowDefinition(
      plan,
      BotPlatform.TELEGRAM,
      "user-1",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.definition.name).toBe("test-wf");
    expect(result.definition.ownerSenderId).toBe("user-1");
    expect(result.definition.steps).toHaveLength(1);
  });

  it("propagates maxRuns to definition", () => {
    const plan = {
      name: "once-wf",
      trigger: { type: "cron" as const, value: "0 * * * *" },
      steps: [
        {
          id: "s1",
          type: "action" as const,
          label: "Do",
          prompt: "Do it",
          onError: "stop" as const,
        },
      ],
      maxRuns: 1,
    };
    const result = planToWorkflowDefinition(
      plan,
      BotPlatform.TELEGRAM,
      "user-1",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.definition.maxRuns).toBe(1);
  });

  it("omits maxRuns when not provided", () => {
    const plan = {
      name: "forever",
      trigger: { type: "cron" as const, value: "0 * * * *" },
      steps: [
        {
          id: "s1",
          type: "action" as const,
          label: "Do",
          prompt: "Do it",
          onError: "stop" as const,
        },
      ],
    };
    const result = planToWorkflowDefinition(
      plan,
      BotPlatform.TELEGRAM,
      "user-1",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.definition.maxRuns).toBeUndefined();
  });

  it("propagates retireOnSuccess to definition", () => {
    const plan = {
      name: "poll-wf",
      trigger: { type: "cron" as const, value: "*/5 * * * *" },
      steps: [
        {
          id: "s1",
          type: "action" as const,
          label: "Check",
          prompt: "Check build",
          onError: "stop" as const,
        },
      ],
      retireOnSuccess: true,
    };
    const result = planToWorkflowDefinition(
      plan,
      BotPlatform.TELEGRAM,
      "user-1",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.definition.retireOnSuccess).toBe(true);
  });

  it("omits retireOnSuccess when not provided", () => {
    const plan = {
      name: "forever",
      trigger: { type: "cron" as const, value: "0 * * * *" },
      steps: [
        {
          id: "s1",
          type: "action" as const,
          label: "Do",
          prompt: "Do it",
          onError: "stop" as const,
        },
      ],
    };
    const result = planToWorkflowDefinition(
      plan,
      BotPlatform.TELEGRAM,
      "user-1",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.definition.retireOnSuccess).toBeUndefined();
  });
});
