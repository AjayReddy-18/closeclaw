import { describe, it, expect } from "vitest";
import { detectPermissionPrompt } from "@closeclaw/cursor-agent";

describe("detectPermissionPrompt", () => {
  it("detects an Accept/Deny prompt", () => {
    const output = [
      "Reading file src/utils.ts...",
      "The agent wants to edit 3 files.",
      "  Accept  Deny",
      "",
    ].join("\n");
    const result = detectPermissionPrompt(output);
    expect(result).not.toBeNull();
    expect(result?.promptText).toContain("edit 3 files");
  });

  it("detects a prompt with (a)ccept/(d)eny pattern", () => {
    const output = ["Cursor wants to run: npm test", "(a)ccept (d)eny"].join(
      "\n",
    );
    const result = detectPermissionPrompt(output);
    expect(result).not.toBeNull();
  });

  it("detects a prompt with Accept / Reject pattern", () => {
    const output = [
      "The agent wants to modify src/index.ts",
      "  Accept   Reject",
    ].join("\n");
    const result = detectPermissionPrompt(output);
    expect(result).not.toBeNull();
  });

  it("returns null when no prompt is present", () => {
    const output = [
      "Reading file src/utils.ts...",
      "Analyzing code structure...",
      "Writing changes...",
    ].join("\n");
    const result = detectPermissionPrompt(output);
    expect(result).toBeNull();
  });

  it("returns null for empty output", () => {
    const result = detectPermissionPrompt("");
    expect(result).toBeNull();
  });

  it("extracts context text above the prompt line", () => {
    const output = [
      "Previous output line",
      "Agent wants to delete 5 files in src/old/",
      "  Accept  Deny",
    ].join("\n");
    const result = detectPermissionPrompt(output);
    expect(result).not.toBeNull();
    expect(result?.promptText).toContain("delete 5 files");
  });

  it("does not false-positive on the word accept in normal text", () => {
    const output = "We accept pull requests from all contributors.";
    const result = detectPermissionPrompt(output);
    expect(result).toBeNull();
  });
});
