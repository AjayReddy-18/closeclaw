export const BotPlatform = {
  TELEGRAM: "telegram",
  DISCORD: "discord",
} as const;

export type BotPlatform = (typeof BotPlatform)[keyof typeof BotPlatform];

export const BOT_PLATFORMS: readonly BotPlatform[] = [
  BotPlatform.TELEGRAM,
  BotPlatform.DISCORD,
];

export function isBotPlatform(value: unknown): value is BotPlatform {
  return (
    typeof value === "string" && BOT_PLATFORMS.includes(value as BotPlatform)
  );
}
