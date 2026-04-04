import type { BotPlatform } from "@closeclaw/shared-types";
import { DmPolicy } from "@closeclaw/shared-types";
import type { PairingManager } from "./pairing-manager.js";

export type DmPolicyEnforcerConfig = {
  dmPolicy: DmPolicy;
  allowedSenders?: string[];
  pairingManager: PairingManager;
};

export type DmPolicyEnforcer = {
  shouldAllow(
    senderId: string,
    platform: BotPlatform,
  ): Promise<{ allowed: boolean; pairingCode?: string }>;
};

export function createDmPolicyEnforcer(
  config: DmPolicyEnforcerConfig,
): DmPolicyEnforcer {
  return {
    async shouldAllow(senderId, platform) {
      if (config.dmPolicy === DmPolicy.OPEN) {
        return { allowed: true };
      }
      if (config.dmPolicy === DmPolicy.ALLOWLIST) {
        const list = config.allowedSenders ?? [];
        return { allowed: list.includes(senderId) };
      }
      const ok = await config.pairingManager.isSenderApproved(
        platform,
        senderId,
      );
      if (ok) return { allowed: true };
      const req = await config.pairingManager.createRequest(
        platform,
        senderId,
      );
      return { allowed: false, pairingCode: req.code };
    },
  };
}
