import { describe, it, expect, vi } from "vitest";
import type { BotAdapter, BotHealthResult } from "@closeclaw/bot-adapters";
import { checkHealth } from "../../../packages/gateway/src/health-checker.js";

function mockAdapter(
  platform: "telegram" | "discord",
  result: BotHealthResult,
): BotAdapter {
  return {
    platform,
    connect: vi.fn(),
    disconnect: vi.fn(),
    healthCheck: vi.fn(() => Promise.resolve(result)),
    onMessage: vi.fn(),
    sendMessage: vi.fn(),
    sendTypingIndicator: vi.fn(),
  };
}

describe("checkHealth", () => {
  it("returns healthy when all adapters report connected", async () => {
    const a = mockAdapter("telegram", { connected: true, botUsername: "t" });
    const b = mockAdapter("discord", { connected: true, botUsername: "d" });
    const r = await checkHealth([a, b]);
    expect(r.status).toBe("healthy");
    expect(r.channels.telegram?.connected).toBe(true);
    expect(r.channels.discord?.connected).toBe(true);
  });

  it("returns unhealthy when any adapter fails", async () => {
    const a = mockAdapter("telegram", {
      connected: false,
      error: "down",
    });
    const r = await checkHealth([a]);
    expect(r.status).toBe("unhealthy");
    expect(r.channels.telegram?.connected).toBe(false);
    expect(r.channels.telegram?.error).toBe("down");
  });
});
