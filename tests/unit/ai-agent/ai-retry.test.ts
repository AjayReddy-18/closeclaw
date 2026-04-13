import { describe, it, expect, vi } from "vitest";

describe("ai-retry utilities", () => {
  async function loadModule() {
    return import("../../../packages/ai-agent/src/ai-retry.js");
  }

  describe("errorStatus", () => {
    it("returns statusCode from error object", async () => {
      const { errorStatus } = await loadModule();
      expect(errorStatus({ statusCode: 429 })).toBe(429);
    });

    it("returns status from error object", async () => {
      const { errorStatus } = await loadModule();
      expect(errorStatus({ status: 500 })).toBe(500);
    });

    it("returns undefined for non-object", async () => {
      const { errorStatus } = await loadModule();
      expect(errorStatus("string")).toBeUndefined();
      expect(errorStatus(null)).toBeUndefined();
    });

    it("returns undefined for non-numeric status", async () => {
      const { errorStatus } = await loadModule();
      expect(errorStatus({ status: "not-a-number" })).toBeUndefined();
    });
  });

  describe("isRateLimitError", () => {
    it("detects 429 status code", async () => {
      const { isRateLimitError } = await loadModule();
      expect(isRateLimitError({ statusCode: 429 })).toBe(true);
    });

    it("detects rate limit in error message", async () => {
      const { isRateLimitError } = await loadModule();
      expect(isRateLimitError(new Error("Rate limit exceeded"))).toBe(true);
    });

    it("detects rate limit in string", async () => {
      const { isRateLimitError } = await loadModule();
      expect(isRateLimitError("rate limit")).toBe(true);
    });

    it("returns false for non-rate-limit error", async () => {
      const { isRateLimitError } = await loadModule();
      expect(isRateLimitError(new Error("something else"))).toBe(false);
    });
  });

  describe("retryWithBackoff", () => {
    it("succeeds on first attempt", async () => {
      const { retryWithBackoff } = await loadModule();
      const fn = vi.fn().mockResolvedValue("ok");
      const result = await retryWithBackoff(fn, 3, 10);
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries on rate limit and succeeds", async () => {
      const { retryWithBackoff } = await loadModule();
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ statusCode: 429 })
        .mockResolvedValue("ok");
      const result = await retryWithBackoff(fn, 3, 1);
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("throws non-rate-limit errors immediately", async () => {
      const { retryWithBackoff } = await loadModule();
      const fn = vi.fn().mockRejectedValue(new Error("auth failed"));
      await expect(retryWithBackoff(fn, 3, 1)).rejects.toThrow("auth failed");
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("extractResponseText", () => {
    it("returns text when present", async () => {
      const { extractResponseText } = await loadModule();
      const result = extractResponseText({ text: "Hello" } as never);
      expect(result).toBe("Hello");
    });

    it("returns text from last step when main text is empty", async () => {
      const { extractResponseText } = await loadModule();
      const result = extractResponseText({
        text: "",
        steps: [{ text: "Step result" }],
      } as never);
      expect(result).toBe("Step result");
    });

    it("returns empty response message when no text found", async () => {
      const { extractResponseText } = await loadModule();
      const result = extractResponseText({
        text: "",
        steps: [{ text: "" }],
      } as never);
      expect(result).toContain("nothing to say");
    });

    it("skips empty step texts", async () => {
      const { extractResponseText } = await loadModule();
      const result = extractResponseText({
        text: "",
        steps: [{ text: "First" }, { text: "  " }, { text: "" }],
      } as never);
      expect(result).toBe("First");
    });
  });
});
