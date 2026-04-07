import { describe, it, expect } from "vitest";
import {
  parseDuration,
  formatDuration,
} from "../../../../packages/ai-agent/src/scheduler/duration-parser.js";

describe("parseDuration", () => {
  it("parses seconds", () => {
    expect(parseDuration("10s")).toBe(10_000);
  });

  it("parses minutes", () => {
    expect(parseDuration("30m")).toBe(30 * 60 * 1000);
  });

  it("parses hours", () => {
    expect(parseDuration("2h")).toBe(2 * 60 * 60 * 1000);
  });

  it("parses days", () => {
    expect(parseDuration("1d")).toBe(24 * 60 * 60 * 1000);
  });

  it("returns undefined for invalid format", () => {
    expect(parseDuration("abc")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseDuration("")).toBeUndefined();
  });

  it("returns undefined for negative number", () => {
    expect(parseDuration("-5m")).toBeUndefined();
  });

  it("returns undefined for zero", () => {
    expect(parseDuration("0m")).toBeUndefined();
  });

  it("returns undefined for unknown unit", () => {
    expect(parseDuration("10x")).toBeUndefined();
  });

  it("handles large values", () => {
    expect(parseDuration("999d")).toBe(999 * 24 * 60 * 60 * 1000);
  });
});

describe("formatDuration", () => {
  it("formats days", () => {
    expect(formatDuration(2 * 24 * 60 * 60 * 1000)).toBe("2d");
  });

  it("formats hours", () => {
    expect(formatDuration(3 * 60 * 60 * 1000)).toBe("3h");
  });

  it("formats minutes", () => {
    expect(formatDuration(45 * 60 * 1000)).toBe("45m");
  });

  it("formats seconds", () => {
    expect(formatDuration(30_000)).toBe("30s");
  });

  it("prefers largest fitting unit", () => {
    expect(formatDuration(60 * 60 * 1000)).toBe("1h");
  });

  it("falls back to minutes for non-round values", () => {
    expect(formatDuration(90 * 60 * 1000)).toBe("90m");
  });
});
