import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WorkflowDefinition } from "@closeclaw/workflow";

describe("WorkflowScheduler", () => {
  async function loadModule() {
    return import("../../../packages/cli/src/commands/workflow-scheduler.js");
  }

  function makeDefinition(
    overrides?: Partial<WorkflowDefinition>,
  ): WorkflowDefinition {
    return {
      id: "wf-1",
      name: "test-cron",
      ownerPlatform: "telegram",
      ownerSenderId: "user-1",
      trigger: { type: "cron", value: "0 9 * * *" },
      steps: [
        {
          id: "s1",
          type: "action",
          label: "Go",
          prompt: "go",
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

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("arms a cron workflow and schedules a timer", async () => {
    const { createWorkflowScheduler } = await loadModule();
    const onExecute = vi.fn().mockResolvedValue(undefined);
    const scheduler = createWorkflowScheduler(onExecute);
    scheduler.armWorkflow(makeDefinition());
    expect(scheduler.isArmed("wf-1")).toBe(true);
  });

  it("disarms a workflow and clears its timer", async () => {
    const { createWorkflowScheduler } = await loadModule();
    const onExecute = vi.fn().mockResolvedValue(undefined);
    const scheduler = createWorkflowScheduler(onExecute);
    scheduler.armWorkflow(makeDefinition());
    scheduler.disarmWorkflow("wf-1");
    expect(scheduler.isArmed("wf-1")).toBe(false);
  });

  it("does not arm non-cron workflows", async () => {
    const { createWorkflowScheduler } = await loadModule();
    const onExecute = vi.fn().mockResolvedValue(undefined);
    const scheduler = createWorkflowScheduler(onExecute);
    scheduler.armWorkflow(
      makeDefinition({ trigger: { type: "webhook", value: "/hook" } }),
    );
    expect(scheduler.isArmed("wf-1")).toBe(false);
  });

  it("stop clears all timers", async () => {
    const { createWorkflowScheduler } = await loadModule();
    const onExecute = vi.fn().mockResolvedValue(undefined);
    const scheduler = createWorkflowScheduler(onExecute);
    scheduler.armWorkflow(makeDefinition());
    scheduler.armWorkflow(makeDefinition({ id: "wf-2" }));
    scheduler.stop();
    expect(scheduler.isArmed("wf-1")).toBe(false);
    expect(scheduler.isArmed("wf-2")).toBe(false);
  });

  it("start re-arms provided workflows", async () => {
    const { createWorkflowScheduler } = await loadModule();
    const onExecute = vi.fn().mockResolvedValue(undefined);
    const scheduler = createWorkflowScheduler(onExecute);
    const workflows = [
      makeDefinition({ id: "wf-1" }),
      makeDefinition({ id: "wf-2" }),
    ];
    scheduler.start(workflows);
    expect(scheduler.isArmed("wf-1")).toBe(true);
    expect(scheduler.isArmed("wf-2")).toBe(true);
  });

  it("skips disabled workflows on start", async () => {
    const { createWorkflowScheduler } = await loadModule();
    const onExecute = vi.fn().mockResolvedValue(undefined);
    const scheduler = createWorkflowScheduler(onExecute);
    scheduler.start([makeDefinition({ status: "disabled" })]);
    expect(scheduler.isArmed("wf-1")).toBe(false);
  });

  it("does not reschedule after disarmWorkflow is called during execution", async () => {
    const { createWorkflowScheduler } = await loadModule();
    let executeCb: (() => void) | undefined;
    const onExecute = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          executeCb = resolve;
        }),
    );
    const scheduler = createWorkflowScheduler(onExecute);
    scheduler.armWorkflow(makeDefinition());
    expect(scheduler.isArmed("wf-1")).toBe(true);
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(onExecute).toHaveBeenCalledOnce();
    scheduler.disarmWorkflow("wf-1");
    executeCb!();
    await vi.advanceTimersByTimeAsync(100);
    expect(scheduler.isArmed("wf-1")).toBe(false);
  });
});
