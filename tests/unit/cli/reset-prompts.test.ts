import { describe, it, expect, vi, beforeEach } from "vitest";
import { select, confirm } from "@inquirer/prompts";

describe("selectResetScope", () => {
  beforeEach(() => {
    vi.mocked(select).mockReset();
  });

  it("returns chosen reset scope", async () => {
    vi.mocked(select).mockResolvedValueOnce("all");
    const { selectResetScope } =
      await import("../../../packages/cli/src/prompts/reset-scope-select.js");
    const result = await selectResetScope();
    expect(result).toBe("all");
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "What would you like to reset?",
        choices: expect.arrayContaining([
          expect.objectContaining({ value: "all" }),
          expect.objectContaining({ value: "specific" }),
        ]) as unknown[],
      }),
    );
  });
});

describe("selectPlatformToReset", () => {
  beforeEach(() => {
    vi.mocked(select).mockReset();
  });

  it("returns the only platform without prompting when list has one entry", async () => {
    const { selectPlatformToReset } =
      await import("../../../packages/cli/src/prompts/reset-platform-select.js");
    const result = await selectPlatformToReset(["telegram"]);
    expect(result).toBe("telegram");
    expect(select).not.toHaveBeenCalled();
  });

  it("prompts user when multiple platforms exist", async () => {
    vi.mocked(select).mockResolvedValueOnce("discord");
    const { selectPlatformToReset } =
      await import("../../../packages/cli/src/prompts/reset-platform-select.js");
    const result = await selectPlatformToReset(["telegram", "discord"]);
    expect(result).toBe("discord");
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Which platform should be reset?",
      }),
    );
  });
});

describe("confirmReset", () => {
  beforeEach(() => {
    vi.mocked(confirm).mockReset();
  });

  it("returns user confirmation result", async () => {
    vi.mocked(confirm).mockResolvedValueOnce(true);
    const { confirmReset } =
      await import("../../../packages/cli/src/prompts/reset-confirm.js");
    const result = await confirmReset("Are you sure?");
    expect(result).toBe(true);
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Are you sure?", default: false }),
    );
  });

  it("returns false when user declines", async () => {
    vi.mocked(confirm).mockResolvedValueOnce(false);
    const { confirmReset } =
      await import("../../../packages/cli/src/prompts/reset-confirm.js");
    const result = await confirmReset("Delete everything?");
    expect(result).toBe(false);
  });
});
