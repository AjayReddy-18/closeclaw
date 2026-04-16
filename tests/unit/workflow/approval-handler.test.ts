import { describe, it, expect, vi } from "vitest";
import type { ApprovalDecision } from "@closeclaw/workflow";

describe("ApprovalHandler", () => {
  async function loadModule() {
    return import("../../../packages/workflow/src/approval-handler.js");
  }

  it("returns approved when callback approves", async () => {
    const { requestApproval } = await loadModule();
    const callback = vi.fn().mockResolvedValue("approved" as ApprovalDecision);
    const result = await requestApproval("Deploy?", callback);
    expect(result).toBe("approved");
    expect(callback).toHaveBeenCalledWith("Deploy?");
  });

  it("returns denied when callback denies", async () => {
    const { requestApproval } = await loadModule();
    const callback = vi.fn().mockResolvedValue("denied" as ApprovalDecision);
    const result = await requestApproval("Run?", callback);
    expect(result).toBe("denied");
  });

  it("returns timeout when callback times out", async () => {
    const { requestApproval } = await loadModule();
    const callback = vi.fn().mockResolvedValue("timeout" as ApprovalDecision);
    const result = await requestApproval("Approve?", callback);
    expect(result).toBe("timeout");
  });

  it("returns denied when callback throws", async () => {
    const { requestApproval } = await loadModule();
    const callback = vi.fn().mockRejectedValue(new Error("Network error"));
    const result = await requestApproval("Approve?", callback);
    expect(result).toBe("denied");
  });
});
