import { describe, it, expect, vi, beforeEach } from "vitest";
import { select } from "@inquirer/prompts";
import type { BotPlatform } from "@closeclaw/shared-types";

describe("selectPlatform", () => {
  beforeEach(() => {
    vi.mocked(select).mockReset();
  });

  it("returns the only platform without calling select", async () => {
    const { selectPlatform } = await import(
      "../../../packages/cli/src/prompts/platform-select.js"
    );
    const result = await selectPlatform(["telegram"]);
    expect(result).toBe("telegram");
    expect(select).not.toHaveBeenCalled();
  });

  it("calls select with mapped choices and returns selection", async () => {
    vi.mocked(select).mockResolvedValueOnce("discord" as BotPlatform);
    const { selectPlatform } = await import(
      "../../../packages/cli/src/prompts/platform-select.js"
    );
    const result = await selectPlatform(["telegram", "discord"]);
    expect(result).toBe("discord");
    expect(select).toHaveBeenCalledTimes(1);
    const row = vi.mocked(select).mock.calls[0];
    expect(row).toBeDefined();
    const opts = row![0];
    expect(opts).toBeDefined();
    const arg = opts as unknown as {
      choices: { name: BotPlatform; value: BotPlatform }[];
    };
    expect(arg.choices).toEqual([
      { name: "telegram", value: "telegram" },
      { name: "discord", value: "discord" },
    ]);
  });
});
