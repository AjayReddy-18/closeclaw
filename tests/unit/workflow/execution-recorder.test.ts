import { describe, it, expect } from "vitest";
import type { StepResult } from "@closeclaw/workflow";

describe("ExecutionRecorder", () => {
  async function loadModule() {
    return import("../../../packages/workflow/src/execution-recorder.js");
  }

  function makeStepResult(overrides?: Partial<StepResult>): StepResult {
    return {
      stepId: "step-1",
      stepLabel: "Test step",
      status: "success",
      output: "done",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 100,
      ...overrides,
    };
  }

  it("creates a record with running status", async () => {
    const { createExecutionRecorder } = await loadModule();
    const recorder = createExecutionRecorder("wf-1", "My Workflow", "cron");
    const record = recorder.getRecord();
    expect(record.workflowId).toBe("wf-1");
    expect(record.workflowName).toBe("My Workflow");
    expect(record.triggeredBy).toBe("cron");
    expect(record.status).toBe("running");
    expect(record.stepResults).toHaveLength(0);
  });

  it("appends step results", async () => {
    const { createExecutionRecorder } = await loadModule();
    const recorder = createExecutionRecorder("wf-1", "Test", "cron");
    recorder.addStepResult(makeStepResult({ stepId: "s1" }));
    recorder.addStepResult(makeStepResult({ stepId: "s2" }));
    expect(recorder.getRecord().stepResults).toHaveLength(2);
  });

  it("finalizes with completed status", async () => {
    const { createExecutionRecorder } = await loadModule();
    const recorder = createExecutionRecorder("wf-1", "Test", "webhook");
    recorder.addStepResult(makeStepResult());
    const record = recorder.finalize("completed");
    expect(record.status).toBe("completed");
    expect(record.completedAt).toBeDefined();
    expect(record.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("finalizes with failed status", async () => {
    const { createExecutionRecorder } = await loadModule();
    const recorder = createExecutionRecorder("wf-1", "Test", "cron");
    const record = recorder.finalize("failed");
    expect(record.status).toBe("failed");
  });

  it("finalizes with aborted status and reason", async () => {
    const { createExecutionRecorder } = await loadModule();
    const recorder = createExecutionRecorder("wf-1", "Test", "cron");
    const record = recorder.finalize("aborted", "User denied approval");
    expect(record.status).toBe("aborted");
    expect(record.abortReason).toBe("User denied approval");
  });

  it("generates a unique execution ID", async () => {
    const { createExecutionRecorder } = await loadModule();
    const r1 = createExecutionRecorder("wf-1", "A", "cron");
    const r2 = createExecutionRecorder("wf-1", "A", "cron");
    expect(r1.getRecord().id).not.toBe(r2.getRecord().id);
  });

  it("sets trigger payload when provided", async () => {
    const { createExecutionRecorder } = await loadModule();
    const payload = { key: "value" };
    const recorder = createExecutionRecorder(
      "wf-1",
      "Test",
      "webhook",
      payload,
    );
    expect(recorder.getRecord().triggerPayload).toEqual(payload);
  });
});
