import { z } from "zod";
import { tool } from "ai";
import type { BotPlatform } from "@closeclaw/shared-types";
import type { PreferenceStore } from "../preference-store.js";

export function createSavePreferenceTool(
  store: PreferenceStore,
  platform: BotPlatform,
  senderId: string,
) {
  return tool({
    description:
      "Save a user preference. Call this when the user shares personal info " +
      "like their name, timezone, language preference, likes, or dislikes.",
    inputSchema: z.object({
      key: z.string().describe("Category name, e.g. 'name', 'timezone'"),
      value: z.string().describe("The preference value"),
    }),
    execute: async ({ key, value }) => {
      store.upsertPreference(platform, senderId, key, value);
      return `Saved preference: ${key} = ${value}`;
    },
  });
}

export function createForgetPreferenceTool(
  store: PreferenceStore,
  platform: BotPlatform,
  senderId: string,
) {
  return tool({
    description:
      "Remove a stored user preference. Call this when the user asks to " +
      "forget specific personal information.",
    inputSchema: z.object({
      key: z.string().describe("The preference key to remove"),
    }),
    execute: async ({ key }) => {
      const removed = store.removePreference(platform, senderId, key);
      return removed
        ? `Removed preference: ${key}`
        : `Preference '${key}' not found`;
    },
  });
}
