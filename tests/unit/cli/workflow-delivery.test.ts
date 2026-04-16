import { describe, it, expect, vi } from "vitest";
import {
  shouldNotifyWorkflowOutcome,
  shouldRetire,
  executeWorkflowAndNotify,
} from "../../../packages/cli/src/commands/workflow-delivery.js";
import { createWorkflowStore } from "@closeclaw/workflow";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function makeWorkflow(overrides?: Record<string, unknown>) {
  return {
    id: "wf-1",
    name: "t",
    ownerPlatform: "telegram" as const,
    ownerSenderId: "u1",
    trigger: { type: "cron" as const, value: "0 * * * *" },
    steps: [
      {
        id: "a",
        type: "action" as const,
        label: "L",
        prompt: "p",
        onError: "stop" as const,
      },
    ],
    status: "active" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    runCount: 0,
    ...overrides,
  };
}

describe("shouldNotifyWorkflowOutcome", () => {
  it("skips telegram for cron when completed", () => {
    expect(shouldNotifyWorkflowOutcome("cron", "completed")).toBe(false);
  });

  it("notifies for cron when failed", () => {
    expect(shouldNotifyWorkflowOutcome("cron", "failed")).toBe(true);
  });

  it("notifies for webhook when completed", () => {
    expect(shouldNotifyWorkflowOutcome("webhook", "completed")).toBe(true);
  });

  it("suppresses notification for condition_unmet", () => {
    expect(shouldNotifyWorkflowOutcome("cron", "condition_unmet")).toBe(false);
    expect(shouldNotifyWorkflowOutcome("webhook", "condition_unmet")).toBe(
      false,
    );
  });
});

describe("shouldRetire", () => {
  it("retires on success when retireOnSuccess is set", () => {
    const wf = makeWorkflow({ retireOnSuccess: true });
    expect(shouldRetire(wf, "completed", 1)).toBe(true);
  });

  it("does not retire on failure when retireOnSuccess is set", () => {
    const wf = makeWorkflow({ retireOnSuccess: true });
    expect(shouldRetire(wf, "failed", 1)).toBe(false);
  });

  it("retires when maxRuns reached regardless of status", () => {
    const wf = makeWorkflow({ maxRuns: 3 });
    expect(shouldRetire(wf, "failed", 3)).toBe(true);
  });

  it("does not retire when below maxRuns", () => {
    const wf = makeWorkflow({ maxRuns: 3 });
    expect(shouldRetire(wf, "completed", 2)).toBe(false);
  });

  it("does not retire a plain workflow on success", () => {
    const wf = makeWorkflow();
    expect(shouldRetire(wf, "completed", 5)).toBe(false);
  });

  it("does not retire retireOnSuccess workflow on condition_unmet", () => {
    const wf = makeWorkflow({ retireOnSuccess: true });
    expect(shouldRetire(wf, "condition_unmet", 1)).toBe(false);
  });
});

describe("executeWorkflowAndNotify", () => {
  it("persists execution and increments runCount", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-del-"));
    const store = createWorkflowStore(dir);
    const wf = makeWorkflow();
    store.saveWorkflow(wf);
    const running = new Map();
    const processor = {
      processMessage: vi.fn().mockResolvedValue("ok"),
    };
    await executeWorkflowAndNotify(running, wf, processor, [], store);
    const updated = store.getWorkflow("wf-1");
    expect(updated?.runCount).toBe(1);
    expect(store.getExecutions("wf-1", 5).length).toBeGreaterThanOrEqual(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it("auto-disables workflow when maxRuns is reached", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-max-"));
    const store = createWorkflowStore(dir);
    const wf = makeWorkflow({ id: "wf-max", maxRuns: 1 });
    store.saveWorkflow(wf);
    const disarm = vi.fn();
    await executeWorkflowAndNotify(
      new Map(),
      wf,
      { processMessage: vi.fn().mockResolvedValue("ok") },
      [],
      store,
      undefined,
      { onDisarm: disarm },
    );
    expect(store.getWorkflow("wf-max")?.status).toBe("disabled");
    expect(disarm).toHaveBeenCalledWith("wf-max");
    rmSync(dir, { recursive: true, force: true });
  });

  it("does not disable when runCount is below maxRuns", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-below-"));
    const store = createWorkflowStore(dir);
    const wf = makeWorkflow({
      id: "wf-b",
      maxRuns: 3,
      trigger: { type: "webhook" as const, value: "/hook" },
    });
    store.saveWorkflow(wf);
    const disarm = vi.fn();
    await executeWorkflowAndNotify(
      new Map(),
      wf,
      { processMessage: vi.fn().mockResolvedValue("ok") },
      [],
      store,
      undefined,
      { onDisarm: disarm },
    );
    expect(store.getWorkflow("wf-b")?.status).toBe("active");
    expect(disarm).not.toHaveBeenCalled();
    rmSync(dir, { recursive: true, force: true });
  });

  it("retires cron workflow on success when retireOnSuccess is true", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-retire-"));
    const store = createWorkflowStore(dir);
    const wf = makeWorkflow({ id: "wf-r", retireOnSuccess: true });
    store.saveWorkflow(wf);
    const disarm = vi.fn();
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const adapter = { platform: "telegram", sendMessage } as never;
    await executeWorkflowAndNotify(
      new Map(),
      wf,
      { processMessage: vi.fn().mockResolvedValue("build passed") },
      [adapter],
      store,
      undefined,
      { onDisarm: disarm },
    );
    expect(store.getWorkflow("wf-r")?.status).toBe("disabled");
    expect(disarm).toHaveBeenCalledWith("wf-r");
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage.mock.calls[0][1]).toContain("auto-disabled");
    rmSync(dir, { recursive: true, force: true });
  });

  it("does not retire retireOnSuccess workflow when steps fail", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-nretire-"));
    const store = createWorkflowStore(dir);
    const wf = makeWorkflow({ id: "wf-nr", retireOnSuccess: true });
    store.saveWorkflow(wf);
    const disarm = vi.fn();
    await executeWorkflowAndNotify(
      new Map(),
      wf,
      {
        processMessage: vi.fn().mockRejectedValue(new Error("boom")),
      },
      [],
      store,
      undefined,
      { onDisarm: disarm },
    );
    expect(store.getWorkflow("wf-nr")?.status).toBe("active");
    expect(disarm).not.toHaveBeenCalled();
    rmSync(dir, { recursive: true, force: true });
  });

  it("sends retirement notification for silent cron workflows", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-notify-"));
    const store = createWorkflowStore(dir);
    const wf = makeWorkflow({ id: "wf-n", maxRuns: 1 });
    store.saveWorkflow(wf);
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const adapter = { platform: "telegram", sendMessage } as never;
    await executeWorkflowAndNotify(
      new Map(),
      wf,
      { processMessage: vi.fn().mockResolvedValue("ok") },
      [adapter],
      store,
      undefined,
      { onDisarm: vi.fn() },
    );
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage.mock.calls[0][1]).toContain("auto-disabled");
    rmSync(dir, { recursive: true, force: true });
  });

  it("skips execution if workflow is already disabled in store", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-guard-"));
    const store = createWorkflowStore(dir);
    const wf = makeWorkflow({ id: "wf-g" });
    store.saveWorkflow(wf);
    store.updateWorkflow("wf-g", { status: "disabled" });
    const processor = { processMessage: vi.fn().mockResolvedValue("ok") };
    const disarm = vi.fn();
    await executeWorkflowAndNotify(
      new Map(),
      wf,
      processor,
      [],
      store,
      undefined,
      { onDisarm: disarm },
    );
    expect(processor.processMessage).not.toHaveBeenCalled();
    expect(disarm).toHaveBeenCalledWith("wf-g");
    rmSync(dir, { recursive: true, force: true });
  });
});
