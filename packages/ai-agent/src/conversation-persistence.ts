import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { BotPlatform } from "@closeclaw/shared-types";
import type { ConversationFileData } from "./persistence-types.js";

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

function readJsonSafe(path: string): ConversationFileData | null {
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as ConversationFileData;
  } catch {
    return null;
  }
}

function writeAtomic(path: string, data: ConversationFileData): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf-8");
  renameSync(tmp, path);
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export interface ConversationPersistence {
  load(platform: BotPlatform, senderId: string): ConversationFileData | null;
  save(
    platform: BotPlatform,
    senderId: string,
    data: ConversationFileData,
  ): void;
  remove(platform: BotPlatform, senderId: string): void;
}

export function createConversationPersistence(
  baseDir: string,
): ConversationPersistence {
  ensureDir(baseDir);

  function load(
    platform: BotPlatform,
    senderId: string,
  ): ConversationFileData | null {
    const fp = filePath(baseDir, platform, senderId);
    if (!existsSync(fp)) return null;
    return readJsonSafe(fp);
  }

  function save(
    platform: BotPlatform,
    senderId: string,
    data: ConversationFileData,
  ): void {
    ensureDir(baseDir);
    writeAtomic(filePath(baseDir, platform, senderId), data);
  }

  function remove(platform: BotPlatform, senderId: string): void {
    const fp = filePath(baseDir, platform, senderId);
    try {
      unlinkSync(fp);
    } catch {
      void 0;
    }
  }

  return { load, save, remove };
}
