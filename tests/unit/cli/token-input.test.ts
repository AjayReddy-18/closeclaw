import { describe, it, expect, vi, beforeEach } from "vitest";
import { password } from "@inquirer/prompts";
import { validateBotToken } from "@closeclaw/shared-types";

describe("inputBotToken", () => {
  beforeEach(() => {
    vi.mocked(password).mockReset();
  });

  it("returns token from password prompt when valid", async () => {
    vi.mocked(password).mockImplementation(
      (async (opts) => {
        expect(opts.validate?.("123456:Ab_c")).toBe(true);
        return "123456:Ab_c";
      }) as typeof password,
    );
    const { inputBotToken } = await import(
      "../../../packages/cli/src/prompts/token-input.js"
    );
    await expect(inputBotToken("telegram")).resolves.toBe("123456:Ab_c");
  });

  it("passes validate that defers to validateBotToken", async () => {
    vi.mocked(password).mockImplementation(
      (async (opts) => {
        const bad = opts.validate?.("not-a-telegram-token");
        expect(bad).toBe("Invalid token format");
        const good = opts.validate?.("987654321:ValidToken-abc");
        expect(good).toBe(true);
        return "987654321:ValidToken-abc";
      }) as typeof password,
    );
    const { inputBotToken } = await import(
      "../../../packages/cli/src/prompts/token-input.js"
    );
    await inputBotToken("telegram");
    expect(validateBotToken("telegram", "987654321:ValidToken-abc")).toBe(
      true,
    );
  });
});
