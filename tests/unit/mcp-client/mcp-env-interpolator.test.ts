import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  interpolateEnvVars,
  interpolateRecord,
} from "../../../packages/mcp-client/src/mcp-env-interpolator.js";

describe("interpolateEnvVars", () => {
  beforeEach(() => {
    process.env["TEST_TOKEN"] = "my-secret-token";
    process.env["ANOTHER_VAR"] = "another-value";
  });

  afterEach(() => {
    delete process.env["TEST_TOKEN"];
    delete process.env["ANOTHER_VAR"];
  });

  it("replaces ${env:VAR} with environment variable value", () => {
    expect(interpolateEnvVars("Bearer ${env:TEST_TOKEN}")).toBe(
      "Bearer my-secret-token",
    );
  });

  it("replaces multiple env vars in one string", () => {
    const result = interpolateEnvVars("${env:TEST_TOKEN}:${env:ANOTHER_VAR}");
    expect(result).toBe("my-secret-token:another-value");
  });

  it("returns empty string for missing env var and warns", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = interpolateEnvVars("Token ${env:MISSING_VAR}");
    expect(result).toBe("Token ");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("MISSING_VAR"),
    );
    warnSpy.mockRestore();
  });

  it("returns plain string unchanged", () => {
    expect(interpolateEnvVars("no-env-here")).toBe("no-env-here");
  });

  it("handles empty string", () => {
    expect(interpolateEnvVars("")).toBe("");
  });
});

describe("interpolateRecord", () => {
  beforeEach(() => {
    process.env["KEY_A"] = "value-a";
  });

  afterEach(() => {
    delete process.env["KEY_A"];
  });

  it("interpolates all values in a record", () => {
    const input = {
      Authorization: "Token ${env:KEY_A}",
      Plain: "no-change",
    };
    const result = interpolateRecord(input);
    expect(result).toEqual({
      Authorization: "Token value-a",
      Plain: "no-change",
    });
  });

  it("returns empty record for empty input", () => {
    expect(interpolateRecord({})).toEqual({});
  });
});
