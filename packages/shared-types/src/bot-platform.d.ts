export declare const BotPlatform: {
    readonly TELEGRAM: "telegram";
    readonly DISCORD: "discord";
};
export type BotPlatform = (typeof BotPlatform)[keyof typeof BotPlatform];
export declare const BOT_PLATFORMS: readonly BotPlatform[];
export declare function isBotPlatform(value: unknown): value is BotPlatform;
//# sourceMappingURL=bot-platform.d.ts.map