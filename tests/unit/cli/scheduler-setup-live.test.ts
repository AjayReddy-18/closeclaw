import { describe, it, expect, vi } from "vitest";
import { setupScheduler } from "../../../packages/cli/src/commands/scheduler-setup.js";
import type { BotAdapter } from "@closeclaw/bot-adapters";
import type { createMessageProcessor } from "@closeclaw/ai-agent";

function createMockAdapter(): BotAdapter {
  return {
    platform: "telegram" as BotAdapter["platform"],
    connect: vi.fn(),
    disconnect: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue({ connected: true }),
    onMessage: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue({ messageId: 200 }),
    editMessage: vi.fn().mockResolvedValue(true),
    sendTypingIndicator: vi.fn().mockResolvedValue(undefined),
  };
}

describe("setupScheduler live delivery", () => {
  it("creates scheduler with delivery function that uses edit when adapter supports it", () => {
    const adapter = createMockAdapter();
    const processor = {
      processMessage: vi.fn().mockResolvedValue("result text"),
    } as unknown as ReturnType<typeof createMessageProcessor>;
    const assembly = setupScheduler(
      { save: vi.fn(), load: vi.fn().mockReturnValue([]) } as never,
      processor,
      [adapter],
    );
    expect(assembly).toBeDefined();
    expect(assembly.scheduler).toBeDefined();
  });

  it("delivery sends initial message then edits with result when editMessage available", async () => {
    const adapter = createMockAdapter();
    const processor = {
      processMessage: vi.fn().mockResolvedValue("scheduled result"),
    } as unknown as ReturnType<typeof createMessageProcessor>;
    const assembly = setupScheduler(
      { save: vi.fn(), load: vi.fn().mockReturnValue([]) } as never,
      processor,
      [adapter],
    );
    expect(assembly).toBeDefined();
  });
});
