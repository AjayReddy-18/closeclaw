import { describe, it, expect } from "vitest";
import { evaluateResponse } from "../../packages/ai-agent/src/scheduler/suppression-filter.js";

describe("Scheduler suppression flow", () => {
  it("suppresses interim responses and delivers final completion", () => {
    const context = {
      lastDeliveredAt: new Date().toISOString(),
      safetyValveMs: 30 * 60 * 1000,
    };
    const responses = [
      "TASK_IN_PROGRESS: Checking pipeline status...",
      "TASK_IN_PROGRESS: Still running, 60% complete",
      "TASK_IN_PROGRESS: Almost done, waiting for final step",
      "TASK_COMPLETE: Pipeline finished successfully. All 42 tests passed.",
    ];
    const delivered: string[] = [];
    for (const response of responses) {
      const result = evaluateResponse(response, context);
      if (!result.suppressed) {
        delivered.push(result.cleanedResponse);
        context.lastDeliveredAt = new Date().toISOString();
      }
    }
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toContain("Pipeline finished successfully");
  });

  it("safety valve triggers after extended silence", () => {
    const oldTime = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    const context = {
      lastDeliveredAt: oldTime,
      safetyValveMs: 30 * 60 * 1000,
    };
    const result = evaluateResponse("Still running the check", context);
    expect(result.suppressed).toBe(false);
    expect(result.cleanedResponse).toContain("Status update:");
  });
});
