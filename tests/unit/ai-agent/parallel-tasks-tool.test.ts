import { describe, it, expect } from "vitest";

describe("createParallelTasksTool", () => {
  async function loadModule() {
    return import("../../../packages/ai-agent/src/tools/parallel-tasks-tool.js");
  }

  it("exports a createParallelTasksTool function", async () => {
    const mod = await loadModule();
    expect(typeof mod.createParallelTasksTool).toBe("function");
  });

  it("returns a tool with description", async () => {
    const { createParallelTasksTool } = await loadModule();
    const tool = createParallelTasksTool();
    expect(tool.description).toContain("parallel");
  });

  it("tool execute returns the tasks array", async () => {
    const { createParallelTasksTool } = await loadModule();
    const tool = createParallelTasksTool();
    const tasks = [
      { label: "Fetch Jira", prompt: "Get Jira issues" },
      { label: "Check build", prompt: "Check CI status" },
    ];
    const result = await tool.execute(
      { tasks },
      { toolCallId: "test", messages: [], abortSignal: new AbortController().signal },
    );
    expect(result).toEqual(tasks);
  });

  it("exported schema rejects fewer than 2 tasks", async () => {
    const { parallelTasksSchema } = await loadModule();
    const result = parallelTasksSchema.safeParse({
      tasks: [{ label: "One", prompt: "Only one" }],
    });
    expect(result.success).toBe(false);
  });

  it("exported schema rejects more than 5 tasks", async () => {
    const { parallelTasksSchema } = await loadModule();
    const tasks = Array.from({ length: 6 }, (_, i) => ({
      label: `Task ${i}`,
      prompt: `Do task ${i}`,
    }));
    const result = parallelTasksSchema.safeParse({ tasks });
    expect(result.success).toBe(false);
  });

  it("exported schema accepts valid 2-5 tasks", async () => {
    const { parallelTasksSchema } = await loadModule();
    const tasks = [
      { label: "A", prompt: "Do A" },
      { label: "B", prompt: "Do B" },
      { label: "C", prompt: "Do C" },
    ];
    const result = parallelTasksSchema.safeParse({ tasks });
    expect(result.success).toBe(true);
  });
});
