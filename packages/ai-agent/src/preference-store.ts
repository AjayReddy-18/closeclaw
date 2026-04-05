import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { BotPlatform } from "@closeclaw/shared-types";
import type {
  PreferenceFileData,
  PreferenceEntry,
} from "./persistence-types.js";

function fileName(platform: BotPlatform, senderId: string): string {
  return `${platform}-${senderId}.json`;
}

function filePath(
  baseDir: string,
  platform: BotPlatform,
  senderId: string,
): string {
  return join(baseDir, fileName(platform, senderId));
}

function readJsonSafe(path: string): PreferenceFileData | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as PreferenceFileData;
  } catch {
    return null;
  }
}

function writeAtomic(path: string, data: PreferenceFileData): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf-8");
  renameSync(tmp, path);
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function emptyPreferences(
  platform: BotPlatform,
  senderId: string,
): PreferenceFileData {
  return {
    platform,
    senderId,
    preferences: [],
    lastModifiedAt: new Date().toISOString(),
  };
}

function upsertEntry(
  prefs: PreferenceEntry[],
  key: string,
  value: string,
): void {
  const idx = prefs.findIndex((p) => p.key === key);
  const entry: PreferenceEntry = {
    key,
    value,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) prefs[idx] = entry;
  else prefs.push(entry);
}

export interface PreferenceStore {
  load(platform: BotPlatform, senderId: string): PreferenceFileData | null;
  save(platform: BotPlatform, senderId: string, data: PreferenceFileData): void;
  upsertPreference(
    platform: BotPlatform,
    senderId: string,
    key: string,
    value: string,
  ): void;
  removePreference(
    platform: BotPlatform,
    senderId: string,
    key: string,
  ): boolean;
}

export function createPreferenceStore(baseDir: string): PreferenceStore {
  ensureDir(baseDir);

  function load(
    platform: BotPlatform,
    senderId: string,
  ): PreferenceFileData | null {
    const fp = filePath(baseDir, platform, senderId);
    if (!existsSync(fp)) return null;
    return readJsonSafe(fp);
  }

  function save(
    platform: BotPlatform,
    senderId: string,
    data: PreferenceFileData,
  ): void {
    ensureDir(baseDir);
    writeAtomic(filePath(baseDir, platform, senderId), data);
  }

  function upsertPreference(
    platform: BotPlatform,
    senderId: string,
    key: string,
    value: string,
  ): void {
    const existing =
      load(platform, senderId) ?? emptyPreferences(platform, senderId);
    upsertEntry(existing.preferences, key, value);
    existing.lastModifiedAt = new Date().toISOString();
    save(platform, senderId, existing);
  }

  function removePreference(
    platform: BotPlatform,
    senderId: string,
    key: string,
  ): boolean {
    const existing = load(platform, senderId);
    if (!existing) return false;
    const idx = existing.preferences.findIndex((p) => p.key === key);
    if (idx < 0) return false;
    existing.preferences.splice(idx, 1);
    existing.lastModifiedAt = new Date().toISOString();
    save(platform, senderId, existing);
    return true;
  }

  return { load, save, upsertPreference, removePreference };
}
