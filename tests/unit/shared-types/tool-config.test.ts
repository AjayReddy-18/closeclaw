import { describe, it, expect } from "vitest";
import {
  TOOL_NAMES,
  DEFAULT_TOOL_CONFIG,
  isToolName,
  isValidToolConfig,
} from "@closeclaw/shared-types";

describe("TOOL_NAMES", () => {
  it("has 3 entries", () => {
    expect(TOOL_NAMES).toHaveLength(3);
  });
});

describe("isToolName", () => {
  it.each(TOOL_NAMES)("returns true for %s", (name) => {
    expect(isToolName(name)).toBe(true);
  });

  it("returns false for invalid tool names", () => {
    expect(isToolName("filesystem")).toBe(false);
    expect(isToolName("")).toBe(false);
    expect(isToolName("DATETIME")).toBe(false);
  });
});

describe("DEFAULT_TOOL_CONFIG", () => {
  it("is valid per isValidToolConfig", () => {
    expect(isValidToolConfig(DEFAULT_TOOL_CONFIG)).toBe(true);
  });
});

describe("isValidToolConfig", () => {
  const base = { ...DEFAULT_TOOL_CONFIG };

  it("accepts a valid config", () => {
    expect(isValidToolConfig(base)).toBe(true);
  });

  it("rejects non-object", () => {
    expect(isValidToolConfig(null)).toBe(false);
    expect(isValidToolConfig("x")).toBe(false);
  });

  it("rejects wrong enabled type", () => {
    expect(isValidToolConfig({ ...base, enabled: "yes" })).toBe(false);
  });

  it("rejects non-array allowedTools", () => {
    expect(isValidToolConfig({ ...base, allowedTools: {} })).toBe(false);
  });

  it("rejects invalid tool name in allowedTools", () => {
    expect(
      isValidToolConfig({ ...base, allowedTools: ["datetime", "bad_tool"] }),
    ).toBe(false);
  });

  it("rejects wrong maxCallDepth type", () => {
    expect(isValidToolConfig({ ...base, maxCallDepth: "10" })).toBe(false);
  });

  it("rejects maxCallDepth less than 1", () => {
    expect(isValidToolConfig({ ...base, maxCallDepth: 0 })).toBe(false);
  });

  it("rejects wrong timeoutMs type", () => {
    expect(isValidToolConfig({ ...base, timeoutMs: true })).toBe(false);
  });

  it("rejects timeoutMs less than 1000", () => {
    expect(isValidToolConfig({ ...base, timeoutMs: 999 })).toBe(false);
  });
});
