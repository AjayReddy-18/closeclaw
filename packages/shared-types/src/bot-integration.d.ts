import { type BotPlatform } from "./bot-platform.js";
import { DmPolicy } from "./dm-policy.js";
export interface BotIntegration {
    platform: BotPlatform;
    botToken: string;
    enabled: boolean;
    dmPolicy: DmPolicy;
    allowedSenders?: string[];
    createdAt: string;
}
export declare function validateBotToken(platform: BotPlatform, token: string): boolean;
export declare function isValidBotIntegration(value: unknown): value is BotIntegration;
//# sourceMappingURL=bot-integration.d.ts.map