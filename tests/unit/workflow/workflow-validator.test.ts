import { describe, it, expect } from "vitest";
import type { WorkflowDefinition } from "@closeclaw/workflow";

describe("validateWorkflowDefinition", () => {
  async function loadModule() {
    return import("../../../packages/workflow/src/workflow-validator.js");
  }

  function validDefinition(): WorkflowDefinition {
    return {
      id: "abc123",
      name: "test-workflow",
      ownerPlatform: "telegram",
      ownerSenderId: "user-1",
      trigger: { type: "cron", value: "0 9 * * 1-5" },
      steps: [
        {
          id: "step-1",
          type: "action",
          label: "Fetch data",
          prompt: "Get the latest data",
          onError: "stop",
        },
      ],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runCount: 0,
    };
  }

  it("accepts a valid workflow definition", async () => {
    const { validateWorkflowDefinition } = await loadModule();
    const result = validateWorkflowDefinition(validDefinition());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing name", async () => {
    const { validateWorkflowDefinition } = await loadModule();
    const def = validDefinition();
    (def as Record<string, unknown>).name = "";
    const result = validateWorkflowDefinition(def);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects invalid trigger type", async () => {
    const { validateWorkflowDefinition } = await loadModule();
    const def = validDefinition();
    (def.trigger as Record<string, unknown>).type = "invalid";
    const result = validateWorkflowDefinition(def);
    expect(result.valid).toBe(false);
  });

  it("rejects empty steps array", async () => {
    const { validateWorkflowDefinition } = await loadModule();
    const def = validDefinition();
    def.steps = [];
    const result = validateWorkflowDefinition(def);
    expect(result.valid).toBe(false);
  });

  it("rejects steps exceeding MAX_STEPS", async () => {
    const { validateWorkflowDefinition } = await loadModule();
    const def = validDefinition();
    def.steps = Array.from({ length: 21 }, (_, i) => ({
      id: `step-${String(i)}`,
      type: "action" as const,
      label: `Step ${String(i)}`,
      prompt: "Do something",
      onError: "stop" as const,
    }));
    const result = validateWorkflowDefinition(def);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("20"))).toBe(true);
  });

  it("rejects invalid step type", async () => {
    const { validateWorkflowDefinition } = await loadModule();
    const def = validDefinition();
    (def.steps[0] as Record<string, unknown>).type = "unknown";
    const result = validateWorkflowDefinition(def);
    expect(result.valid).toBe(false);
  });

  it("validates condition step with thenSteps and elseSteps", async () => {
    const { validateWorkflowDefinition } = await loadModule();
    const def = validDefinition();
    def.steps = [
      {
        id: "cond-1",
        type: "condition",
        label: "Check result",
        condition: "Is it good?",
        thenSteps: [
          {
            id: "then-1",
            type: "action",
            label: "Good path",
            prompt: "Do good thing",
            onError: "stop",
          },
        ],
        elseSteps: [],
      },
    ];
    const result = validateWorkflowDefinition(def);
    expect(result.valid).toBe(true);
  });

  it("validates parallel step with branches", async () => {
    const { validateWorkflowDefinition } = await loadModule();
    const def = validDefinition();
    def.steps = [
      {
        id: "par-1",
        type: "parallel",
        label: "Run checks",
        branches: [
          [
            {
              id: "b1",
              type: "action",
              label: "Check A",
              prompt: "A",
              onError: "continue",
            },
          ],
        ],
      },
    ];
    const result = validateWorkflowDefinition(def);
    expect(result.valid).toBe(true);
  });

  it("rejects parallel step exceeding MAX_PARALLEL_BRANCHES", async () => {
    const { validateWorkflowDefinition } = await loadModule();
    const def = validDefinition();
    def.steps = [
      {
        id: "par-1",
        type: "parallel",
        label: "Too many",
        branches: Array.from({ length: 6 }, (_, i) => [
          {
            id: `b-${String(i)}`,
            type: "action" as const,
            label: `Branch ${String(i)}`,
            prompt: "do",
            onError: "continue" as const,
          },
        ]),
      },
    ];
    const result = validateWorkflowDefinition(def);
    expect(result.valid).toBe(false);
  });

  it("validates loop step", async () => {
    const { validateWorkflowDefinition } = await loadModule();
    const def = validDefinition();
    def.steps = [
      {
        id: "loop-1",
        type: "loop",
        label: "Poll",
        untilCondition: "Is it done?",
        maxIterations: 10,
        delaySeconds: 5,
        steps: [
          {
            id: "poll-step",
            type: "action",
            label: "Check status",
            prompt: "check",
            onError: "continue",
          },
        ],
      },
    ];
    const result = validateWorkflowDefinition(def);
    expect(result.valid).toBe(true);
  });

  it("rejects loop exceeding MAX_LOOP_ITERATIONS", async () => {
    const { validateWorkflowDefinition } = await loadModule();
    const def = validDefinition();
    def.steps = [
      {
        id: "loop-1",
        type: "loop",
        label: "Poll",
        untilCondition: "done?",
        maxIterations: 51,
        delaySeconds: 1,
        steps: [
          {
            id: "s1",
            type: "action",
            label: "Go",
            prompt: "go",
            onError: "stop",
          },
        ],
      },
    ];
    const result = validateWorkflowDefinition(def);
    expect(result.valid).toBe(false);
  });

  it("rejects non-object input", async () => {
    const { validateWorkflowDefinition } = await loadModule();
    const result = validateWorkflowDefinition("not an object");
    expect(result.valid).toBe(false);
  });

  it("rejects missing required fields", async () => {
    const { validateWorkflowDefinition } = await loadModule();
    const result = validateWorkflowDefinition({ id: "x" });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("accepts definition with optional maxRuns", async () => {
    const { validateWorkflowDefinition } = await loadModule();
    const def = { ...validDefinition(), maxRuns: 5 };
    const result = validateWorkflowDefinition(def);
    expect(result.valid).toBe(true);
  });

  it("rejects maxRuns of 0", async () => {
    const { validateWorkflowDefinition } = await loadModule();
    const def = { ...validDefinition(), maxRuns: 0 };
    const result = validateWorkflowDefinition(def);
    expect(result.valid).toBe(false);
  });

  it("rejects fractional maxRuns", async () => {
    const { validateWorkflowDefinition } = await loadModule();
    const def = { ...validDefinition(), maxRuns: 1.5 };
    const result = validateWorkflowDefinition(def);
    expect(result.valid).toBe(false);
  });

  it("accepts definition with retireOnSuccess", async () => {
    const { validateWorkflowDefinition } = await loadModule();
    const def = { ...validDefinition(), retireOnSuccess: true };
    const result = validateWorkflowDefinition(def);
    expect(result.valid).toBe(true);
  });
});
