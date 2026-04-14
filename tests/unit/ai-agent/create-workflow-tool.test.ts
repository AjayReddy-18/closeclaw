import { describe, it, expect } from "vitest";

describe("createWorkflowTool", () => {
  async function loadModule() {
    return import(
      "../../../packages/ai-agent/src/tools/create-workflow-tool.js"
    );
  }

  it("returns a tool object with description and execute", async () => {
    const { createWorkflowTool } = await loadModule();
    const ref = { plan: null };
    const tool = createWorkflowTool(ref);
    expect(tool.description).toBeDefined();
    expect(typeof tool.description).toBe("string");
  });

  it("populates WorkflowPlanRef on execute", async () => {
    const { createWorkflowTool } = await loadModule();
    const ref: { plan: unknown } = { plan: null };
    const tool = createWorkflowTool(ref);
    const input = {
      name: "test-workflow",
      trigger: { type: "cron" as const, value: "0 9 * * *" },
      steps: [
        {
          id: "s1",
          type: "action",
          label: "Do",
          prompt: "Do it",
          onError: "stop",
        },
      ],
    };
    await tool.execute(input);
    expect(ref.plan).toBeDefined();
    expect(ref.plan).toHaveProperty("name", "test-workflow");
  });

  it("supports oneShot flag", async () => {
    const { createWorkflowTool } = await loadModule();
    const ref: { plan: unknown } = { plan: null };
    const tool = createWorkflowTool(ref);
    const input = {
      name: "oneshot-test",
      trigger: { type: "cron" as const, value: "0 9 * * *" },
      steps: [
        {
          id: "s1",
          type: "action",
          label: "Go",
          prompt: "go",
          onError: "stop",
        },
      ],
      oneShot: true,
    };
    await tool.execute(input);
    const plan = ref.plan as Record<string, unknown>;
    expect(plan.oneShot).toBe(true);
  });

  it("validates input schema - rejects empty name", async () => {
    const { workflowToolSchema } = await loadModule();
    const result = workflowToolSchema.safeParse({
      name: "",
      trigger: { type: "cron", value: "0 9 * * *" },
      steps: [],
    });
    expect(result.success).toBe(false);
  });

  it("validates input schema - rejects invalid trigger type", async () => {
    const { workflowToolSchema } = await loadModule();
    const result = workflowToolSchema.safeParse({
      name: "test",
      trigger: { type: "invalid", value: "0 9 * * *" },
      steps: [{ id: "s1", type: "action", label: "x", prompt: "x" }],
    });
    expect(result.success).toBe(false);
  });
});
