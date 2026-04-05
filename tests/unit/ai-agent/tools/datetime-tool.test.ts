import { describe, it, expect } from "vitest";
import { createDatetimeTool } from "../../../../packages/ai-agent/src/tools/datetime-tool.js";

describe("createDatetimeTool", () => {
  it("returns a tool object", () => {
    const t = createDatetimeTool();
    expect(t.type).toBe("function");
    expect(t.description).toContain("date");
    expect(t.parameters).toBeDefined();
    expect(t.execute).toBeTypeOf("function");
  });

  it("execute returns iso, unix, timezone, formatted", async () => {
    const t = createDatetimeTool();
    const out = (await t.execute!()) as {
      iso: string;
      unix: number;
      timezone: string;
      formatted: string;
    };
    expect(typeof out.iso).toBe("string");
    expect(typeof out.unix).toBe("number");
    expect(typeof out.timezone).toBe("string");
    expect(typeof out.formatted).toBe("string");
    expect(Number.isNaN(Date.parse(out.iso))).toBe(false);
  });
});
