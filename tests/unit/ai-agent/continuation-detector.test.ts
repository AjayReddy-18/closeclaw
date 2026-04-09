import { describe, it, expect } from "vitest";
import { shouldContinue } from "../../../packages/ai-agent/src/continuation-detector.js";

describe("shouldContinue", () => {
  const stepsWithToolCalls = [{ toolCalls: [{ toolName: "search" }] }];
  const stepsWithoutToolCalls = [{ text: "hello" }];

  it("returns true for 'let me check' with tool calls in steps", () => {
    expect(
      shouldContinue("Let me check the deploy folder.", stepsWithToolCalls, 0),
    ).toBe(true);
  });

  it("returns true for 'I'll search' pattern", () => {
    expect(
      shouldContinue(
        "I'll search for the helm-values repo.",
        stepsWithToolCalls,
        0,
      ),
    ).toBe(true);
  });

  it("returns true for 'let me also' pattern", () => {
    expect(
      shouldContinue(
        "Let me also get the version tags.",
        stepsWithToolCalls,
        0,
      ),
    ).toBe(true);
  });

  it("returns true for 'I need to check' pattern", () => {
    expect(
      shouldContinue(
        "I need to check the other repository.",
        stepsWithToolCalls,
        0,
      ),
    ).toBe(true);
  });

  it("returns false when no tool calls were made", () => {
    expect(
      shouldContinue("Let me check something.", stepsWithoutToolCalls, 0),
    ).toBe(false);
  });

  it("returns false for a normal complete response", () => {
    expect(
      shouldContinue(
        "Here are the deployed services and their versions.",
        stepsWithToolCalls,
        0,
      ),
    ).toBe(false);
  });

  it("returns false when max continuation rounds exceeded", () => {
    expect(shouldContinue("Let me check again.", stepsWithToolCalls, 3)).toBe(
      false,
    );
  });

  it("returns false at exactly the max round limit", () => {
    expect(shouldContinue("Let me search more.", stepsWithToolCalls, 3)).toBe(
      false,
    );
  });

  it("returns true just under the max round limit", () => {
    expect(shouldContinue("Let me search more.", stepsWithToolCalls, 2)).toBe(
      true,
    );
  });

  it("detects 'looking into it' pattern", () => {
    expect(
      shouldContinue(
        "Looking into the deploy pipeline now.",
        stepsWithToolCalls,
        0,
      ),
    ).toBe(true);
  });

  it("detects 'checking now' pattern", () => {
    expect(
      shouldContinue(
        "Checking now for the SIT environment.",
        stepsWithToolCalls,
        0,
      ),
    ).toBe(true);
  });
});
