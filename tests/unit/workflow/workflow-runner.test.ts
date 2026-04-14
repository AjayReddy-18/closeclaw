import { describe, it, expect, vi } from "vitest";
import type { WorkflowDefinition } from "@closeclaw/workflow";

describe("WorkflowRunner", () => {
  async function loadModule() {
    return import("../../../packages/workflow/src/workflow-runner.js");
  }

  function makeDefinition(
    overrides?: Partial<WorkflowDefinition>,
  ): WorkflowDefinition {
    return {
      id: "wf-1",
      name: "test-workflow",
      ownerPlatform: "telegram",
      ownerSenderId: "user-1",
      trigger: { type: "cron", value: "0 9 * * *" },
      steps: [
        {
          id: "s1",
          type: "action",
          label: "Step 1",
          prompt: "Do step 1",
          onError: "stop",
        },
      ],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runCount: 0,
      ...overrides,
    };
  }

  function makeDeps(responses: (string | Error)[] = ["Done"]) {
    let callIndex = 0;
    const processMessage = vi.fn().mockImplementation(async () => {
      const resp = responses[callIndex] ?? responses[responses.length - 1];
      callIndex++;
      if (resp instanceof Error) throw resp;
      return resp;
    });
    return {
      processMessage,
      platform: "telegram",
      senderId: "user-1",
      onProgress: vi.fn(),
    };
  }

  it("executes sequential steps and returns completed record", async () => {
    const { runWorkflow } = await loadModule();
    const def = makeDefinition({
      steps: [
        { id: "s1", type: "action", label: "A", prompt: "a", onError: "stop" },
        { id: "s2", type: "action", label: "B", prompt: "b", onError: "stop" },
      ],
    });
    const deps = makeDeps(["Result A", "Result B"]);
    const record = await runWorkflow(def, deps);
    expect(record.status).toBe("completed");
    expect(record.stepResults).toHaveLength(2);
    expect(record.stepResults[0].output).toBe("Result A");
    expect(record.stepResults[1].output).toBe("Result B");
  });

  it("stops on failure when onError is stop", async () => {
    const { runWorkflow } = await loadModule();
    const def = makeDefinition({
      steps: [
        { id: "s1", type: "action", label: "A", prompt: "a", onError: "stop" },
        { id: "s2", type: "action", label: "B", prompt: "b", onError: "stop" },
      ],
    });
    const deps = makeDeps([new Error("Fail")]);
    const record = await runWorkflow(def, deps);
    expect(record.status).toBe("failed");
    expect(record.stepResults).toHaveLength(1);
    expect(deps.processMessage).toHaveBeenCalledTimes(1);
  });

  it("continues on failure when onError is continue", async () => {
    const { runWorkflow } = await loadModule();
    const def = makeDefinition({
      steps: [
        {
          id: "s1",
          type: "action",
          label: "A",
          prompt: "a",
          onError: "continue",
        },
        { id: "s2", type: "action", label: "B", prompt: "b", onError: "stop" },
      ],
    });
    const deps = makeDeps([new Error("Fail"), "OK"]);
    const record = await runWorkflow(def, deps);
    expect(record.status).toBe("completed");
    expect(record.stepResults).toHaveLength(2);
  });

  it("forwards outputs between steps via interpolation", async () => {
    const { runWorkflow } = await loadModule();
    const def = makeDefinition({
      steps: [
        {
          id: "s1",
          type: "action",
          label: "A",
          prompt: "Get data",
          onError: "stop",
        },
        {
          id: "s2",
          type: "action",
          label: "B",
          prompt: "Use {{s1.output}}",
          onError: "stop",
        },
      ],
    });
    const deps = makeDeps(["data-value", "processed"]);
    await runWorkflow(def, deps);
    expect(deps.processMessage).toHaveBeenNthCalledWith(
      2,
      "telegram",
      "user-1",
      "Use data-value",
    );
  });

  it("evaluates condition step and takes then branch", async () => {
    const { runWorkflow } = await loadModule();
    const def = makeDefinition({
      steps: [
        {
          id: "s1",
          type: "action",
          label: "Check",
          prompt: "check",
          onError: "stop",
        },
        {
          id: "cond",
          type: "condition",
          label: "Branch",
          condition: "Is it good?",
          thenSteps: [
            {
              id: "then-1",
              type: "action",
              label: "Good",
              prompt: "good",
              onError: "stop",
            },
          ],
          elseSteps: [
            {
              id: "else-1",
              type: "action",
              label: "Bad",
              prompt: "bad",
              onError: "stop",
            },
          ],
        },
      ],
    });
    const deps = makeDeps(["data", "true", "good result"]);
    const record = await runWorkflow(def, deps);
    expect(record.status).toBe("completed");
    const stepIds = record.stepResults.map(
      (r: { stepId: string }) => r.stepId,
    );
    expect(stepIds).toContain("then-1");
    expect(stepIds).not.toContain("else-1");
  });

  it("evaluates condition step and takes else branch", async () => {
    const { runWorkflow } = await loadModule();
    const def = makeDefinition({
      steps: [
        {
          id: "cond",
          type: "condition",
          label: "Branch",
          condition: "Is it bad?",
          thenSteps: [
            {
              id: "then-1",
              type: "action",
              label: "T",
              prompt: "t",
              onError: "stop",
            },
          ],
          elseSteps: [
            {
              id: "else-1",
              type: "action",
              label: "E",
              prompt: "e",
              onError: "stop",
            },
          ],
        },
      ],
    });
    const deps = makeDeps(["false", "else result"]);
    const record = await runWorkflow(def, deps);
    const stepIds = record.stepResults.map(
      (r: { stepId: string }) => r.stepId,
    );
    expect(stepIds).toContain("else-1");
    expect(stepIds).not.toContain("then-1");
  });

  it("reports progress for each step", async () => {
    const { runWorkflow } = await loadModule();
    const def = makeDefinition({
      steps: [
        { id: "s1", type: "action", label: "A", prompt: "a", onError: "stop" },
      ],
    });
    const deps = makeDeps(["OK"]);
    await runWorkflow(def, deps);
    expect(deps.onProgress).toHaveBeenCalled();
  });
});
