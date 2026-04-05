import { describe, it, expect } from "vitest";
import { getTelegramInstructions } from "../../../packages/cli/src/instructions/telegram-setup.js";

describe("getTelegramInstructions", () => {
  it("includes BotFather, newbot command, and bot token guidance", () => {
    const text = getTelegramInstructions();
    expect(text).toContain("BotFather");
    expect(text).toContain("/newbot");
    expect(text.toLowerCase()).toContain("bot token");
  });
});
