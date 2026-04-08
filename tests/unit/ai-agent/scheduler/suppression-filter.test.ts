import { describe, it, expect } from "vitest";
import { evaluateResponse } from "../../../../packages/ai-agent/src/scheduler/suppression-filter.js";

const recentContext = {
  lastDeliveredAt: new Date().toISOString(),
  safetyValveMs: 30 * 60 * 1000,
};

const expiredContext = {
  lastDeliveredAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  safetyValveMs: 30 * 60 * 1000,
};

const neverDelivered = {
  lastDeliveredAt: undefined,
  safetyValveMs: 30 * 60 * 1000,
};

describe("evaluateResponse", () => {
  describe("structured prefixes", () => {
    it("delivers TASK_COMPLETE and strips prefix", () => {
      const result = evaluateResponse(
        "TASK_COMPLETE: Job done!",
        recentContext,
      );
      expect(result.suppressed).toBe(false);
      expect(result.cleanedResponse).toBe("Job done!");
      expect(result.reason).toBe("structured-prefix-complete");
    });

    it("delivers TASK_FAILED and strips prefix", () => {
      const result = evaluateResponse(
        "TASK_FAILED: Error occurred",
        recentContext,
      );
      expect(result.suppressed).toBe(false);
      expect(result.cleanedResponse).toBe("Error occurred");
      expect(result.reason).toBe("structured-prefix-failed");
    });

    it("suppresses TASK_IN_PROGRESS", () => {
      const result = evaluateResponse(
        "TASK_IN_PROGRESS: Still checking",
        recentContext,
      );
      expect(result.suppressed).toBe(true);
      expect(result.reason).toBe("structured-prefix-in-progress");
    });
  });

  describe("keyword heuristics - delivery", () => {
    it("delivers when response contains completion keywords", () => {
      const result = evaluateResponse(
        "The deployment is done and ready",
        recentContext,
      );
      expect(result.suppressed).toBe(false);
      expect(result.reason).toBe("keyword-delivery-signal");
    });

    it("delivers response containing results keyword", () => {
      const result = evaluateResponse("Here are the results", recentContext);
      expect(result.suppressed).toBe(false);
    });
  });

  describe("keyword heuristics - suppression", () => {
    it("suppresses when response contains suppression keywords", () => {
      const result = evaluateResponse("Still running the check", recentContext);
      expect(result.suppressed).toBe(true);
      expect(result.reason).toBe("keyword-suppression-signal");
    });

    it("suppresses no update responses", () => {
      const result = evaluateResponse("No change detected", recentContext);
      expect(result.suppressed).toBe(true);
    });
  });

  describe("safety valve", () => {
    it("delivers suppressed response when safety valve expired", () => {
      const result = evaluateResponse(
        "Still running the check",
        expiredContext,
      );
      expect(result.suppressed).toBe(false);
      expect(result.reason).toBe("safety-valve-expired");
      expect(result.cleanedResponse).toContain("Status update:");
    });

    it("delivers ambiguous response when safety valve expired", () => {
      const result = evaluateResponse("hmm ok", expiredContext);
      expect(result.suppressed).toBe(false);
      expect(result.reason).toBe("ambiguous-safety-valve");
    });

    it("delivers when lastDeliveredAt is undefined", () => {
      const result = evaluateResponse("hmm ok", neverDelivered);
      expect(result.suppressed).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("suppresses empty response", () => {
      const result = evaluateResponse("", recentContext);
      expect(result.suppressed).toBe(true);
      expect(result.reason).toBe("empty-or-heartbeat");
    });

    it("suppresses HEARTBEAT_OK", () => {
      const result = evaluateResponse("HEARTBEAT_OK", recentContext);
      expect(result.suppressed).toBe(true);
    });

    it("delivers substantial content over 200 chars", () => {
      const longResponse = "x".repeat(250);
      const result = evaluateResponse(longResponse, recentContext);
      expect(result.suppressed).toBe(false);
      expect(result.reason).toBe("substantial-content");
    });

    it("suppresses short ambiguous response within safety valve", () => {
      const result = evaluateResponse("ok cool", recentContext);
      expect(result.suppressed).toBe(true);
      expect(result.reason).toBe("ambiguous-default-suppress");
    });
  });
});
