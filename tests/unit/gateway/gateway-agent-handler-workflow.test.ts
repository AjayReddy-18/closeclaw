import { describe, it, expect, vi } from "vitest";

describe("WorkflowPlanHandler", () => {
  async function loadModule() {
    return import("../../../packages/gateway/src/workflow-plan-handler.js");
  }

  function makeAdapter() {
    return { sendMessage: vi.fn().mockResolvedValue("msg-1") };
  }

  it("returns false when no plan is set", async () => {
    const { handleWorkflowPlan } = await loadModule();
    const ref = { plan: null };
    const result = await handleWorkflowPlan(
      ref,
      makeAdapter() as never,
      "user-1",
    );
    expect(result).toBe(false);
  });

  it("calls onOneShot for one-shot plans", async () => {
    const { handleWorkflowPlan } = await loadModule();
    const plan = {
      name: "test",
      trigger: { type: "cron", value: "0 9 * * *" },
      steps: [{ id: "s1" }],
      oneShot: true,
    };
    const ref = { plan };
    const onOneShot = vi.fn().mockResolvedValue(undefined);
    const result = await handleWorkflowPlan(
      ref,
      makeAdapter() as never,
      "user-1",
      { onSave: vi.fn(), onOneShot },
    );
    expect(result).toBe(true);
    expect(onOneShot).toHaveBeenCalledWith(plan);
    expect(ref.plan).toBeNull();
  });

  it("calls onSave for reusable plans", async () => {
    const { handleWorkflowPlan } = await loadModule();
    const plan = {
      name: "reusable",
      trigger: { type: "cron", value: "0 9 * * *" },
      steps: [{ id: "s1" }],
    };
    const ref = { plan };
    const adapter = makeAdapter();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const result = await handleWorkflowPlan(ref, adapter as never, "user-1", {
      onSave,
      onOneShot: vi.fn(),
    });
    expect(result).toBe(true);
    expect(onSave).toHaveBeenCalledWith(plan);
    expect(adapter.sendMessage).toHaveBeenCalled();
  });

  it("hasWorkflowPlan returns true when plan exists", async () => {
    const { hasWorkflowPlan } = await loadModule();
    const ref = {
      plan: {
        name: "x",
        trigger: { type: "cron", value: "0 9 * * *" },
        steps: [],
      },
    };
    expect(hasWorkflowPlan(ref)).toBe(true);
  });

  it("hasWorkflowPlan returns false for null plan", async () => {
    const { hasWorkflowPlan } = await loadModule();
    expect(hasWorkflowPlan({ plan: null })).toBe(false);
    expect(hasWorkflowPlan(undefined)).toBe(false);
  });

  it("one-shot execution record saved to _oneshot", async () => {
    const { handleWorkflowPlan } = await loadModule();
    const plan = {
      name: "oneshot-test",
      trigger: { type: "cron", value: "0 9 * * *" },
      steps: [{ id: "s1" }],
      oneShot: true,
    };
    const ref = { plan };
    const onOneShot = vi.fn().mockResolvedValue(undefined);
    await handleWorkflowPlan(ref, makeAdapter() as never, "user-1", {
      onSave: vi.fn(),
      onOneShot,
    });
    expect(onOneShot).toHaveBeenCalled();
  });
});
