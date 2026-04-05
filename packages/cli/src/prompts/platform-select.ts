import { select } from "@inquirer/prompts";
import type { BotPlatform } from "@closeclaw/shared-types";

export async function selectPlatform(
  availablePlatforms: BotPlatform[],
): Promise<BotPlatform> {
  const only = availablePlatforms[0];
  if (availablePlatforms.length === 1 && only !== undefined) {
    return only;
  }
  return select({
    message: "Choose a platform",
    choices: availablePlatforms.map((p) => ({
      name: p,
      value: p,
    })),
  });
}
