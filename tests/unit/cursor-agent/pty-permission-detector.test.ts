import { describe, it, expect } from "vitest";
import { detectPtyPermission } from "@closeclaw/cursor-agent";

describe("detectPtyPermission", () => {
  it("detects Accept Deny prompt", () => {
    const lines = ["Cursor wants to edit 3 files", "  Accept  Deny"];
    const result = detectPtyPermission(lines);
    expect(result).not.toBeNull();
    expect(result!.displayText).toContain("edit 3 files");
  });

  it("detects (a)ccept (d)eny pattern", () => {
    const lines = ["Run shell command?", "(a)ccept (d)eny"];
    const result = detectPtyPermission(lines);
    expect(result).not.toBeNull();
  });

  it("detects (Y/n) pattern", () => {
    const lines = ["Proceed with changes? (Y/n)"];
    const result = detectPtyPermission(lines);
    expect(result).not.toBeNull();
  });

  it("detects [Y/n] pattern", () => {
    const lines = ["Continue? [Y/n]"];
    const result = detectPtyPermission(lines);
    expect(result).not.toBeNull();
  });

  it("detects workspace trust prompt", () => {
    const lines = ["Do you trust the contents of this directory?", "Yes  No"];
    const result = detectPtyPermission(lines);
    expect(result).not.toBeNull();
    expect(result!.displayText).toContain("trust");
  });

  it("detects 'Are you sure?' prompt", () => {
    const lines = ["Delete all files. Are you sure?"];
    const result = detectPtyPermission(lines);
    expect(result).not.toBeNull();
  });

  it("returns null for normal output", () => {
    const lines = ["Analyzing code...", "Found 5 issues", "Fixing lint errors"];
    expect(detectPtyPermission(lines)).toBeNull();
  });

  it("returns null for empty lines", () => {
    expect(detectPtyPermission([])).toBeNull();
  });

  it("does not false-positive on word 'accept' in normal text", () => {
    const lines = ["We accept pull requests from all contributors."];
    expect(detectPtyPermission(lines)).toBeNull();
  });

  it("extracts context from lines above the prompt", () => {
    const lines = [
      "This is context",
      "About to delete important-file.ts",
      "  Accept  Deny",
    ];
    const result = detectPtyPermission(lines);
    expect(result).not.toBeNull();
    expect(result!.displayText).toContain("delete important-file.ts");
  });
});
