import { describe, it, expect, vi } from "vitest";
import type { WorkflowDefinition } from "@closeclaw/workflow";

describe("Workflow Execution Flow (Integration)", () => {
  async function loadRunner() {
    return import("../../packages/workflow/src/workflow-runner.js");
  }

  function makeDefinition(
    overrides?: Partial<WorkflowDefinition>,
  ): WorkflowDefinition {
    return {
      id: "int-wf-1",
      name: "integration-test",
      ownerPlatform: "telegram",
      ownerSenderId: "user-1",
      trigger: { type: "cron", value: "0 9 * * *" },
      steps: [],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runCount: 0,
      ...overrides,
    };
  }

  it("executes sequential steps with output forwarding", async () => {
    const { runWorkflow } = await loadRunner();
    const def = makeDefinition({
      steps: [
        {
          id: "fetch",
          type: "action",
          label: "Fetch",
          prompt: "Get data",
          onError: "stop",
        },
        {
          id: "process",
          type: "action",
          label: "Process",
          prompt: "Transform {{fetch.output}}",
          onError: "stop",
        },
      ],
    });
    const processMessage = vi
      .fn()
      .mockResolvedValueOnce("raw-data")
      .mockResolvedValueOnce("processed-result");
    const record = await runWorkflow(def, {
      processMessage,
      platform: "telegram",
      senderId: "user-1",
    });
    expect(record.status).toBe("completed");
    expect(record.stepResults).toHaveLength(2);
    expect(processMessage).toHaveBeenNthCalledWith(
      2,
      "telegram",
      "user-1",
      "Transform raw-data",
    );
  });

  it("branches on condition and records correct steps", async () => {
    const { runWorkflow } = await loadRunner();
    const def = makeDefinition({
      steps: [
        {
          id: "check",
          type: "action",
          label: "Check",
          prompt: "Check status",
          onError: "stop",
        },
        {
          id: "branch",
          type: "condition",
          label: "Critical?",
          condition: "Are there critical bugs?",
          thenSteps: [
            {
              id: "alert",
              type: "action",
              label: "Alert",
              prompt: "Send alert",
              onError: "stop",
            },
          ],
          elseSteps: [
            {
              id: "clear",
              type: "action",
              label: "All Clear",
              prompt: "Say all clear",
              onError: "stop",
            },
          ],
        },
      ],
    });
    const processMessage = vi
      .fn()
      .mockResolvedValueOnce("3 critical bugs found")
      .mockResolvedValueOnce("true")
      .mockResolvedValueOnce("Alert sent!");
    const record = await runWorkflow(def, {
      processMessage,
      platform: "telegram",
      senderId: "user-1",
    });
    expect(record.status).toBe("completed");
    const ids = record.stepResults.map((r) => r.stepId);
    expect(ids).toContain("alert");
    expect(ids).not.toContain("clear");
  });

  it("produces execution record with timing data", async () => {
    const { runWorkflow } = await loadRunner();
    const def = makeDefinition({
      steps: [
        {
          id: "s1",
          type: "action",
          label: "Step",
          prompt: "Go",
          onError: "stop",
        },
      ],
    });
    const processMessage = vi.fn().mockResolvedValue("Done");
    const record = await runWorkflow(def, {
      processMessage,
      platform: "telegram",
      senderId: "user-1",
    });
    expect(record.durationMs).toBeGreaterThanOrEqual(0);
    expect(record.completedAt).toBeDefined();
    expect(record.stepResults[0].durationMs).toBeGreaterThanOrEqual(0);
  });
});
