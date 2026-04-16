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

    it("suppresses TASK_IN_PROGRESS when recently delivered", () => {
      const result = evaluateResponse(
        "TASK_IN_PROGRESS: Still checking",
        recentContext,
      );
      expect(result.suppressed).toBe(true);
      expect(result.reason).toBe("structured-prefix-in-progress");
    });

    it("suppresses TASK_IN_PROGRESS even when safety valve expired", () => {
      const result = evaluateResponse(
        "TASK_IN_PROGRESS: Still checking",
        expiredContext,
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

    it("delivers CI/CD responses with passed/triggered keywords", () => {
      expect(
        evaluateResponse("Build passed! Tag: v1.0", recentContext).suppressed,
      ).toBe(false);
      expect(
        evaluateResponse("SIT deploy triggered", recentContext).suppressed,
      ).toBe(false);
      expect(
        evaluateResponse("Docker image published", recentContext).suppressed,
      ).toBe(false);
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

    it("suppression wins when both suppression and delivery keywords match", () => {
      const result = evaluateResponse(
        "(24% — already alerted. Silent.)",
        recentContext,
      );
      expect(result.suppressed).toBe(true);
      expect(result.reason).toBe("keyword-suppression-signal");
    });

    it("suppresses 'still above' monitoring responses", () => {
      const result = evaluateResponse(
        "Battery at 27%, still above 25%. Monitoring continues.",
        recentContext,
      );
      expect(result.suppressed).toBe(true);
    });

    it("suppresses 'condition not met' responses", () => {
      const result = evaluateResponse(
        "Condition not met, no action needed",
        recentContext,
      );
      expect(result.suppressed).toBe(true);
    });
  });

  describe("safety valve", () => {
    it("keeps keyword-suppressed responses suppressed even when safety valve expired", () => {
      const result = evaluateResponse(
        "Still running the check",
        expiredContext,
      );
      expect(result.suppressed).toBe(true);
      expect(result.reason).toBe("keyword-suppression-signal");
    });

    it("delivers ambiguous response when safety valve expired", () => {
      const result = evaluateResponse("hmm ok", expiredContext);
      expect(result.suppressed).toBe(false);
      expect(result.reason).toBe("ambiguous-safety-valve");
    });

    it("delivers ambiguous response when lastDeliveredAt is undefined", () => {
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

    it("suppresses long ambiguous response within safety valve", () => {
      const longResponse = "x".repeat(250);
      const result = evaluateResponse(longResponse, recentContext);
      expect(result.suppressed).toBe(true);
      expect(result.reason).toBe("ambiguous-default-suppress");
    });

    it("suppresses short ambiguous response within safety valve", () => {
      const result = evaluateResponse("ok cool", recentContext);
      expect(result.suppressed).toBe(true);
      expect(result.reason).toBe("ambiguous-default-suppress");
    });
  });
});
