import { describe, it, expect } from "vitest";
import type { ToolConfig, ToolName } from "@closeclaw/shared-types";
import { buildToolMap } from "../../../packages/ai-agent/src/tool-executor.js";

function cfg(partial: Partial<ToolConfig>): ToolConfig {
  return {
    enabled: false,
    allowedTools: [],
    maxCallDepth: 10,
    timeoutMs: 30_000,
    ...partial,
  };
}

describe("buildToolMap", () => {
  it("returns empty object when config.enabled is false", () => {
    expect(
      buildToolMap(
        cfg({
          enabled: false,
          allowedTools: ["datetime", "http_request", "shell_execute"],
        }),
      ),
    ).toEqual({});
  });

  it("returns only allowed tools", () => {
    const m = buildToolMap(
      cfg({
        enabled: true,
        allowedTools: ["datetime"],
      }),
    );
    expect(Object.keys(m)).toEqual(["datetime"]);
    expect(m["datetime"]?.type).toBe("function");
  });

  it("returns all tools when all are allowed", () => {
    const m = buildToolMap(
      cfg({
        enabled: true,
        allowedTools: ["datetime", "http_request", "shell_execute"],
      }),
    );
    expect(Object.keys(m).sort()).toEqual(
      ["datetime", "http_request", "shell_execute"].sort(),
    );
  });

  it("ignores unknown tool names", () => {
    const m = buildToolMap(
      cfg({
        enabled: true,
        allowedTools: ["datetime", "bogus" as ToolName],
      }),
    );
    expect(Object.keys(m)).toEqual(["datetime"]);
  });

  it("returns empty when enabled but allowedTools is empty", () => {
    expect(buildToolMap(cfg({ enabled: true, allowedTools: [] }))).toEqual({});
  });
});
