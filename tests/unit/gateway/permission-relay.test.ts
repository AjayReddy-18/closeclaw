import { describe, it, expect, vi } from "vitest";
import { resolvePermission, createPermissionAsker } from "@closeclaw/gateway";

function createMockAdapter() {
  return {
    platform: "telegram" as const,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendTypingIndicator: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(),
    disconnect: vi.fn(),
    onMessage: vi.fn(),
  };
}

describe("resolvePermission", () => {
  it("returns false when no pending permission", () => {
    expect(resolvePermission("unknown-user", "accept")).toBe(false);
  });

  it("returns false for non-accept/deny text", () => {
    expect(resolvePermission("user1", "hello")).toBe(false);
  });
});

describe("createPermissionAsker", () => {
  it("sends prompt to user via adapter", async () => {
    const adapter = createMockAdapter();
    const asker = createPermissionAsker(adapter, "user-52");
    const promise = asker("Delete 3 files?");
    await new Promise((r) => setTimeout(r, 50));
    resolvePermission("user-52", "accept");
    await promise;
    expect(adapter.sendMessage).toHaveBeenCalledWith(
      "user-52",
      expect.stringContaining("Delete 3 files?"),
    );
  });

  it("resolves to accept when user says yes", async () => {
    const adapter = createMockAdapter();
    const asker = createPermissionAsker(adapter, "user-53");
    const promise = asker("Run command?");
    await new Promise((r) => setTimeout(r, 50));
    resolvePermission("user-53", "yes");
    const result = await promise;
    expect(result).toBe("accept");
  });

  it("resolves to deny when user says no", async () => {
    const adapter = createMockAdapter();
    const asker = createPermissionAsker(adapter, "user-54");
    const promise = asker("Delete everything?");
    await new Promise((r) => setTimeout(r, 50));
    resolvePermission("user-54", "deny");
    const result = await promise;
    expect(result).toBe("deny");
  });

  it("auto-denies after timeout", async () => {
    vi.useFakeTimers();
    const adapter = createMockAdapter();
    const asker = createPermissionAsker(adapter, "user-55");
    const promise = asker("Risky action?");
    await vi.advanceTimersByTimeAsync(120_001);
    const result = await promise;
    expect(result).toBe("deny");
    vi.useRealTimers();
  });
});
