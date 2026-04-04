import { select } from "@inquirer/prompts";
import type { BotPlatform } from "@closeclaw/shared-types";

export async function selectPlatformToReset(
  platforms: BotPlatform[],
): Promise<BotPlatform> {
  const only = platforms[0];
  if (platforms.length === 1 && only !== undefined) {
    return only;
  }
  return select({
    message: "Which platform should be reset?",
    choices: platforms.map((p) => ({ name: p, value: p })),
  });
}
