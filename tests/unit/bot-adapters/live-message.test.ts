import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("createLiveMessage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function loadModule() {
    return import("../../../packages/bot-adapters/src/live-message.js");
  }

  function makeDeps(
    overrides?: Partial<{
      sendMessage: ReturnType<typeof vi.fn>;
      editMessage: ReturnType<typeof vi.fn>;
      throttleMs: number;
    }>,
  ) {
    return {
      sendMessage:
        overrides?.sendMessage ?? vi.fn().mockResolvedValue({ messageId: 100 }),
      editMessage: overrides?.editMessage ?? vi.fn().mockResolvedValue(true),
      throttleMs: overrides?.throttleMs ?? 2000,
    };
  }

  it("first update sends a new message", async () => {
    const { createLiveMessage } = await loadModule();
    const deps = makeDeps();
    const live = createLiveMessage(deps);
    live.update("Thinking...");
    await vi.advanceTimersByTimeAsync(0);
    expect(deps.sendMessage).toHaveBeenCalledWith("Thinking...");
  });

  it("second update within throttle window is queued, not sent immediately", async () => {
    const { createLiveMessage } = await loadModule();
    const deps = makeDeps();
    const live = createLiveMessage(deps);
    live.update("Step 1");
    await vi.advanceTimersByTimeAsync(0);
    live.update("Step 2");
    expect(deps.editMessage).not.toHaveBeenCalled();
  });

  it("queued update is flushed when throttle expires", async () => {
    const { createLiveMessage } = await loadModule();
    const deps = makeDeps();
    const live = createLiveMessage(deps);
    live.update("Step 1");
    await vi.advanceTimersByTimeAsync(0);
    live.update("Step 2");
    await vi.advanceTimersByTimeAsync(2000);
    expect(deps.editMessage).toHaveBeenCalledWith(100, "Step 2");
  });

  it("multiple rapid updates keep only the latest text", async () => {
    const { createLiveMessage } = await loadModule();
    const deps = makeDeps();
    const live = createLiveMessage(deps);
    live.update("Step 1");
    await vi.advanceTimersByTimeAsync(0);
    live.update("Step 2");
    live.update("Step 3");
    live.update("Step 4");
    await vi.advanceTimersByTimeAsync(2000);
    expect(deps.editMessage).toHaveBeenCalledTimes(1);
    expect(deps.editMessage).toHaveBeenCalledWith(100, "Step 4");
  });

  it("finalize edits the message with final text immediately", async () => {
    const { createLiveMessage } = await loadModule();
    const deps = makeDeps();
    const live = createLiveMessage(deps);
    live.update("Thinking...");
    await vi.advanceTimersByTimeAsync(0);
    await live.finalize("Final answer here");
    expect(deps.editMessage).toHaveBeenCalledWith(100, "Final answer here");
  });

  it("finalize sends extra chunks as new messages", async () => {
    const { createLiveMessage } = await loadModule();
    const deps = makeDeps();
    const live = createLiveMessage(deps);
    live.update("Thinking...");
    await vi.advanceTimersByTimeAsync(0);
    await live.finalize("Part 1", ["Part 2", "Part 3"]);
    expect(deps.editMessage).toHaveBeenCalledWith(100, "Part 1");
    expect(deps.sendMessage).toHaveBeenCalledWith("Part 2");
    expect(deps.sendMessage).toHaveBeenCalledWith("Part 3");
  });

  it("finalize cancels pending throttle timer", async () => {
    const { createLiveMessage } = await loadModule();
    const deps = makeDeps();
    const live = createLiveMessage(deps);
    live.update("Step 1");
    await vi.advanceTimersByTimeAsync(0);
    live.update("Step 2 queued");
    await live.finalize("Done!");
    await vi.advanceTimersByTimeAsync(5000);
    expect(deps.editMessage).toHaveBeenCalledTimes(1);
    expect(deps.editMessage).toHaveBeenCalledWith(100, "Done!");
  });

  it("falls back to sendMessage when editMessage returns false", async () => {
    const { createLiveMessage } = await loadModule();
    const editMessage = vi.fn().mockResolvedValue(false);
    const deps = makeDeps({ editMessage });
    const live = createLiveMessage(deps);
    live.update("Step 1");
    await vi.advanceTimersByTimeAsync(0);
    live.update("Step 2");
    await vi.advanceTimersByTimeAsync(2000);
    expect(deps.sendMessage).toHaveBeenCalledWith("Step 2");
  });

  it("falls back to sendMessage when editMessage throws", async () => {
    const { createLiveMessage } = await loadModule();
    const editMessage = vi.fn().mockRejectedValue(new Error("API error"));
    const deps = makeDeps({ editMessage });
    const live = createLiveMessage(deps);
    live.update("Step 1");
    await vi.advanceTimersByTimeAsync(0);
    live.update("Step 2");
    await vi.advanceTimersByTimeAsync(2000);
    expect(deps.sendMessage).toHaveBeenCalledWith("Step 2");
  });

  it("finalize sends new message when no live message exists yet", async () => {
    const { createLiveMessage } = await loadModule();
    const deps = makeDeps();
    const live = createLiveMessage(deps);
    await live.finalize("Direct final");
    expect(deps.sendMessage).toHaveBeenCalledWith("Direct final");
    expect(deps.editMessage).not.toHaveBeenCalled();
  });

  it("finalize falls back to sendMessage when edit fails", async () => {
    const { createLiveMessage } = await loadModule();
    const editMessage = vi.fn().mockResolvedValue(false);
    const deps = makeDeps({ editMessage });
    const live = createLiveMessage(deps);
    live.update("Thinking...");
    await vi.advanceTimersByTimeAsync(0);
    await live.finalize("Result");
    expect(deps.sendMessage).toHaveBeenCalledWith("Result");
  });

  it("dispose clears timers and prevents further updates", async () => {
    const { createLiveMessage } = await loadModule();
    const deps = makeDeps();
    const live = createLiveMessage(deps);
    live.update("Step 1");
    await vi.advanceTimersByTimeAsync(0);
    live.dispose();
    live.update("Step 2 after dispose");
    await vi.advanceTimersByTimeAsync(5000);
    expect(deps.editMessage).not.toHaveBeenCalled();
  });

  it("dispose is safe to call multiple times", async () => {
    const { createLiveMessage } = await loadModule();
    const deps = makeDeps();
    const live = createLiveMessage(deps);
    live.dispose();
    live.dispose();
    expect(true).toBe(true);
  });

  it("falls back when sendMessage returns no messageId", async () => {
    const { createLiveMessage } = await loadModule();
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps({ sendMessage });
    const live = createLiveMessage(deps);
    live.update("Step 1");
    await vi.advanceTimersByTimeAsync(0);
    live.update("Step 2");
    await vi.advanceTimersByTimeAsync(2000);
    expect(sendMessage).toHaveBeenCalledWith("Step 2");
  });

  it("enters fallback mode when first sendMessage throws", async () => {
    const { createLiveMessage } = await loadModule();
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error("send failed"))
      .mockResolvedValue(undefined);
    const deps = makeDeps({ sendMessage });
    const live = createLiveMessage(deps);
    live.update("Step 1");
    await vi.advanceTimersByTimeAsync(0);
    await live.finalize("Done");
    expect(sendMessage).toHaveBeenCalledWith("Done");
  });

  it("reset causes next update to send a new message", async () => {
    const { createLiveMessage } = await loadModule();
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ messageId: 100 })
      .mockResolvedValueOnce({ messageId: 200 });
    const deps = makeDeps({ sendMessage });
    const live = createLiveMessage(deps);
    live.update("Phase 1");
    await vi.advanceTimersByTimeAsync(0);
    expect(sendMessage).toHaveBeenCalledWith("Phase 1");
    live.reset();
    live.update("Phase 2");
    await vi.advanceTimersByTimeAsync(0);
    expect(sendMessage).toHaveBeenCalledWith("Phase 2");
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it("reset allows editing the new message, not the old one", async () => {
    const { createLiveMessage } = await loadModule();
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ messageId: 100 })
      .mockResolvedValueOnce({ messageId: 200 });
    const deps = makeDeps({ sendMessage });
    const live = createLiveMessage(deps);
    live.update("Phase 1");
    await vi.advanceTimersByTimeAsync(0);
    live.reset();
    live.update("Phase 2 start");
    await vi.advanceTimersByTimeAsync(0);
    live.update("Phase 2 progress");
    await vi.advanceTimersByTimeAsync(2000);
    expect(deps.editMessage).toHaveBeenCalledWith(200, "Phase 2 progress");
    expect(deps.editMessage).not.toHaveBeenCalledWith(100, expect.any(String));
  });

  it("finalize after reset edits the new message", async () => {
    const { createLiveMessage } = await loadModule();
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ messageId: 100 })
      .mockResolvedValueOnce({ messageId: 200 });
    const deps = makeDeps({ sendMessage });
    const live = createLiveMessage(deps);
    live.update("Phase 1");
    await vi.advanceTimersByTimeAsync(0);
    live.reset();
    live.update("Phase 2");
    await vi.advanceTimersByTimeAsync(0);
    await live.finalize("All done");
    expect(deps.editMessage).toHaveBeenCalledWith(200, "All done");
  });
});
