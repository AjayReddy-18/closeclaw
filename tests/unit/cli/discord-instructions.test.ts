import { describe, it, expect } from "vitest";
import { getDiscordInstructions } from "../../../packages/cli/src/instructions/discord-setup.js";

describe("getDiscordInstructions", () => {
  it("includes Developer Portal, Bot, and token guidance", () => {
    const text = getDiscordInstructions();
    expect(text).toContain("Developer Portal");
    expect(text).toContain("Bot");
    expect(text.toLowerCase()).toContain("token");
  });
});
