import { describe, it, expect, vi } from "vitest";
import {
  resolvePermission,
  resolveCallbackDecision,
  createPermissionAsker,
  createApprovalAsker,
} from "@closeclaw/gateway";

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

  it("uses sendMessageWithButtons when available", async () => {
    const adapter = {
      ...createMockAdapter(),
      sendMessageWithButtons: vi.fn().mockResolvedValue(undefined),
    };
    const asker = createPermissionAsker(adapter, "user-56");
    const promise = asker("Allow it?");
    await new Promise((r) => setTimeout(r, 50));
    resolvePermission("user-56", "y");
    await promise;
    expect(adapter.sendMessageWithButtons).toHaveBeenCalledWith(
      "user-56",
      "Allow it?",
      expect.any(Array),
    );
  });
});

describe("resolveCallbackDecision", () => {
  it("returns false when no pending decision", () => {
    expect(resolveCallbackDecision("nobody", "approval_accept")).toBe(false);
  });

  it("resolves accept on approval_accept callback", async () => {
    const adapter = createMockAdapter();
    const asker = createPermissionAsker(adapter, "user-60");
    const promise = asker("Execute?");
    await new Promise((r) => setTimeout(r, 50));
    expect(resolveCallbackDecision("user-60", "approval_accept")).toBe(true);
    const result = await promise;
    expect(result).toBe("accept");
  });

  it("resolves deny on approval_deny callback", async () => {
    const adapter = createMockAdapter();
    const asker = createPermissionAsker(adapter, "user-61");
    const promise = asker("Delete?");
    await new Promise((r) => setTimeout(r, 50));
    expect(resolveCallbackDecision("user-61", "approval_deny")).toBe(true);
    const result = await promise;
    expect(result).toBe("deny");
  });

  it("returns false for unknown callback data", async () => {
    const adapter = createMockAdapter();
    const asker = createPermissionAsker(adapter, "user-62");
    asker("Something?");
    await new Promise((r) => setTimeout(r, 50));
    expect(resolveCallbackDecision("user-62", "unknown_data")).toBe(false);
    resolvePermission("user-62", "deny");
  });
});

describe("createApprovalAsker", () => {
  it("sends approval text and resolves approve on accept", async () => {
    const adapter = createMockAdapter();
    const asker = createApprovalAsker(adapter, "user-70");
    const promise = asker([{ command: "npm install", description: "install" }]);
    await new Promise((r) => setTimeout(r, 50));
    resolveCallbackDecision("user-70", "approval_accept");
    const result = await promise;
    expect(result).toBe("approve");
  });

  it("resolves deny on denial", async () => {
    const adapter = createMockAdapter();
    const asker = createApprovalAsker(adapter, "user-71");
    const promise = asker([{ command: "rm -rf", description: "nuke" }]);
    await new Promise((r) => setTimeout(r, 50));
    resolveCallbackDecision("user-71", "approval_deny");
    const result = await promise;
    expect(result).toBe("deny");
  });

  it("calls onSent callback after sending approval message", async () => {
    const adapter = createMockAdapter();
    const onSent = vi.fn();
    const asker = createApprovalAsker(adapter, "user-72", onSent);
    const promise = asker([{ command: "npm test", description: "test" }]);
    await new Promise((r) => setTimeout(r, 50));
    expect(onSent).toHaveBeenCalledTimes(1);
    resolveCallbackDecision("user-72", "approval_accept");
    await promise;
  });
});

describe("createPermissionAsker with onSent", () => {
  it("calls onSent callback after sending permission prompt", async () => {
    const adapter = createMockAdapter();
    const onSent = vi.fn();
    const asker = createPermissionAsker(adapter, "user-80", onSent);
    const promise = asker("Allow shell?");
    await new Promise((r) => setTimeout(r, 50));
    expect(onSent).toHaveBeenCalledTimes(1);
    resolvePermission("user-80", "accept");
    await promise;
  });
});
