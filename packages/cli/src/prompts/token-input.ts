import { password } from "@inquirer/prompts";
import { validateBotToken, type BotPlatform } from "@closeclaw/shared-types";

export async function inputBotToken(platform: BotPlatform): Promise<string> {
  const value = await password({
    message: `Enter ${platform} bot token`,
    mask: true,
    validate: (v) =>
      validateBotToken(platform, v) ? true : "Invalid token format",
  });
  return value;
}
