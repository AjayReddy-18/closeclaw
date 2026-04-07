import { describe, it, expect } from "vitest";
import {
  nextCronOccurrence,
  isValidCronExpression,
} from "../../../../packages/ai-agent/src/scheduler/cron-utils.js";

describe("isValidCronExpression", () => {
  it("accepts standard 5-field cron", () => {
    expect(isValidCronExpression("0 9 * * *")).toBe(true);
  });

  it("accepts cron with ranges", () => {
    expect(isValidCronExpression("0 9-17 * * 1-5")).toBe(true);
  });

  it("accepts cron with steps", () => {
    expect(isValidCronExpression("*/15 * * * *")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidCronExpression("")).toBe(false);
  });

  it("rejects invalid cron", () => {
    expect(isValidCronExpression("not a cron")).toBe(false);
  });

  it("rejects too few fields", () => {
    expect(isValidCronExpression("* *")).toBe(false);
  });
});

describe("nextCronOccurrence", () => {
  it("returns a future date", () => {
    const now = new Date();
    const next = nextCronOccurrence("* * * * *", now);
    expect(next).toBeDefined();
    expect(next!.getTime()).toBeGreaterThan(now.getTime());
  });

  it("respects the base date", () => {
    const base = new Date("2026-06-15T08:00:00Z");
    const next = nextCronOccurrence("0 9 * * *", base);
    expect(next).toBeDefined();
    expect(next!.getHours()).toBe(9);
  });

  it("returns undefined for invalid expression", () => {
    expect(nextCronOccurrence("invalid", new Date())).toBeUndefined();
  });

  it("accepts timezone option", () => {
    const base = new Date("2026-06-15T08:00:00Z");
    const next = nextCronOccurrence("0 9 * * *", base, "America/New_York");
    expect(next).toBeDefined();
  });
});
