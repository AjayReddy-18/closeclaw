import type { BotPlatform } from "@closeclaw/shared-types";
import type { PreferenceStore } from "./preference-store.js";

export function formatPreferencesForContext(
  store: PreferenceStore,
  platform: BotPlatform,
  senderId: string,
): string {
  const data = store.load(platform, senderId);
  if (!data || data.preferences.length === 0) return "";
  const lines = data.preferences.map((p) => `- ${p.key}: ${p.value}`);
  return `User preferences:\n${lines.join("\n")}`;
}
