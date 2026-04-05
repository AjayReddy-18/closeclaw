import { describe, it, expect } from "vitest";
import type { ConversationMessage } from "../../../packages/ai-agent/src/conversation-types.js";
import {
  estimateTokens,
  trimHistory,
} from "../../../packages/ai-agent/src/context-trimmer.js";

function msg(
  role: ConversationMessage["role"],
  content: string,
): ConversationMessage {
  return { role, content, timestamp: new Date() };
}

describe("estimateTokens", () => {
  it("returns correct estimate", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});

describe("trimHistory", () => {
  it("returns empty for empty input", () => {
    expect(trimHistory([], 100)).toEqual([]);
  });

  it("preserves system prompt", () => {
    const system = msg("system", "sys");
    const user = msg("user", "hi");
    const out = trimHistory([system, user], 10_000);
    expect(out[0]).toEqual(system);
  });

  it("trims oldest non-system messages first", () => {
    const system = msg("system", "s");
    const old = msg("user", "old");
    const mid = msg("user", "mid");
    const recent = msg("user", "recent");
    const max =
      estimateTokens(system.content) +
      estimateTokens(mid.content) +
      estimateTokens(recent.content);
    const out = trimHistory([system, old, mid, recent], max);
    expect(out.map((m) => m.content)).toEqual(["s", "mid", "recent"]);
  });

  it("keeps most recent messages", () => {
    const system = msg("system", "x");
    const u1 = msg("user", "a");
    const u2 = msg("user", "bbbb");
    const cap = estimateTokens(system.content) + estimateTokens(u2.content);
    const out = trimHistory([system, u1, u2], cap);
    expect(out.map((m) => m.content)).toEqual(["x", "bbbb"]);
  });

  it("returns just system when single user message exceeds limit", () => {
    const system = msg("system", "sys");
    const huge = msg("user", "x".repeat(400));
    const out = trimHistory([system, huge], estimateTokens(system.content));
    expect(out).toEqual([system]);
  });

  it("handles exact boundary", () => {
    const system = msg("system", "aaaa");
    const u = msg("user", "bbbb");
    const max = estimateTokens("aaaa") + estimateTokens("bbbb");
    const out = trimHistory([system, u], max);
    expect(out).toHaveLength(2);
  });
});
