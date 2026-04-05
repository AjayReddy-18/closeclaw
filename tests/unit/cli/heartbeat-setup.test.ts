import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() => "# Heartbeat checklist\n- [ ] Check CI"),
}));

vi.mock("@closeclaw/ai-agent", () => ({
  createHeartbeatRunner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: vi.fn(() => false),
    runNow: vi.fn(),
  })),
}));

import { setupHeartbeat } from "../../../packages/cli/src/commands/heartbeat-setup.js";
import { createHeartbeatRunner } from "@closeclaw/ai-agent";
import type { Configuration } from "@closeclaw/shared-types";
import type { BotAdapter } from "@closeclaw/bot-adapters";

function makeAdapter(): BotAdapter {
  return {
    platform: "telegram",
    connect: vi.fn(),
    disconnect: vi.fn(),
    onMessage: vi.fn(),
    sendMessage: vi.fn(),
    sendTypingIndicator: vi.fn(),
    healthCheck: vi.fn(),
  };
}

function makeConfig(hb?: Configuration["heartbeat"]): Configuration {
  return {
    version: "1.0.0",
    bots: [],
    agent: { provider: "anthropic", model: "test", apiKey: "k" },
    heartbeat: hb,
  } as Configuration;
}

function makeProcessor() {
  return {
    processMessage: vi.fn().mockResolvedValue("ok"),
    buildToolSet: vi.fn(),
  } as unknown as ReturnType<
    typeof import("@closeclaw/ai-agent").createMessageProcessor
  >;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setupHeartbeat", () => {
  it("returns undefined when no heartbeat config", () => {
    const result = setupHeartbeat(makeConfig(), makeProcessor(), [
      makeAdapter(),
    ]);
    expect(result).toBeUndefined();
  });

  it("returns undefined when heartbeat is disabled", () => {
    const result = setupHeartbeat(
      makeConfig({ enabled: false, every: "30m", target: "last" }),
      makeProcessor(),
      [makeAdapter()],
    );
    expect(result).toBeUndefined();
  });

  it("returns undefined when no adapters", () => {
    const result = setupHeartbeat(
      makeConfig({ enabled: true, every: "30m", target: "last" }),
      makeProcessor(),
      [],
    );
    expect(result).toBeUndefined();
  });

  it("creates heartbeat runner with valid config", () => {
    const adapter = makeAdapter();
    const result = setupHeartbeat(
      makeConfig({ enabled: true, every: "30m", target: "last" }),
      makeProcessor(),
      [adapter],
    );
    expect(result).toBeDefined();
    expect(createHeartbeatRunner).toHaveBeenCalledTimes(1);
    expect(adapter.onMessage).toHaveBeenCalledTimes(1);
  });

  it("registers onMessage listener that tracks last sender", () => {
    const adapter = makeAdapter();
    setupHeartbeat(
      makeConfig({ enabled: true, every: "30m", target: "last" }),
      makeProcessor(),
      [adapter],
    );
    const callback = (adapter.onMessage as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    callback({ senderId: "user123", platform: "telegram", text: "hi" });
    expect(callback).toBeDefined();
  });
});
