import type { Configuration, BotPlatform } from "@closeclaw/shared-types";
import { BOT_PLATFORMS } from "@closeclaw/shared-types";

export interface ConfigState {
  exists: boolean;
  configuredPlatforms: BotPlatform[];
  availablePlatforms: BotPlatform[];
  allPlatformsConfigured: boolean;
}

export function detectConfigState(
  config: Configuration | null,
): ConfigState {
  if (config === null) {
    return {
      exists: false,
      configuredPlatforms: [],
      availablePlatforms: [...BOT_PLATFORMS],
      allPlatformsConfigured: false,
    };
  }

  const configuredPlatforms = Object.keys(config.channels) as BotPlatform[];

  const availablePlatforms = BOT_PLATFORMS.filter(
    (p) => !configuredPlatforms.includes(p),
  );

  return {
    exists: true,
    configuredPlatforms,
    availablePlatforms,
    allPlatformsConfigured: availablePlatforms.length === 0,
  };
}
