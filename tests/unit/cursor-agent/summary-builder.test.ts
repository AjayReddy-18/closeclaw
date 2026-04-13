import { describe, it, expect } from "vitest";
import { buildStructuredSummary } from "@closeclaw/cursor-agent";

const NO_PERMS = { requested: 0, accepted: 0, denied: 0 };

describe("buildStructuredSummary", () => {
  it("extracts created files from output", () => {
    const log = ["Created src/index.ts", "Wrote package.json"];
    const result = buildStructuredSummary(log, "completed", NO_PERMS);
    expect(result).toContain("created: src/index.ts");
    expect(result).toContain("created: package.json");
  });

  it("extracts modified files", () => {
    const log = ["Modified tsconfig.json", "Updated README.md"];
    const result = buildStructuredSummary(log, "completed", NO_PERMS);
    expect(result).toContain("modified: tsconfig.json");
    expect(result).toContain("modified: README.md");
  });

  it("extracts deleted files", () => {
    const log = ["Deleted old-config.ts"];
    const result = buildStructuredSummary(log, "completed", NO_PERMS);
    expect(result).toContain("deleted: old-config.ts");
  });

  it("extracts commands", () => {
    const log = ["Running `npm install`", "Executed npm test"];
    const result = buildStructuredSummary(log, "completed", NO_PERMS);
    expect(result).toContain("npm install");
  });

  it("includes permission stats when present", () => {
    const log = ["Created app.ts"];
    const perms = { requested: 2, accepted: 1, denied: 1 };
    const result = buildStructuredSummary(log, "completed", perms);
    expect(result).toContain("1 accepted");
    expect(result).toContain("1 denied");
    expect(result).toContain("2");
  });

  it("falls back to last line when no structured data", () => {
    const log = ["All done, everything is working now."];
    const result = buildStructuredSummary(log, "completed", NO_PERMS);
    expect(result).toContain("All done");
  });

  it("handles empty output log", () => {
    const result = buildStructuredSummary([], "completed", NO_PERMS);
    expect(result).toContain("No output");
  });

  it("deduplicates files with same name", () => {
    const log = [
      "Created src/app.ts",
      "Modified src/app.ts",
      "Created src/app.ts",
    ];
    const result = buildStructuredSummary(log, "completed", NO_PERMS);
    const matches = result.match(/src\/app\.ts/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("truncates long last-line fallback", () => {
    const longLine = "x".repeat(500);
    const result = buildStructuredSummary([longLine], "completed", NO_PERMS);
    expect(result.length).toBeLessThan(400);
    expect(result).toContain("...");
  });
});
