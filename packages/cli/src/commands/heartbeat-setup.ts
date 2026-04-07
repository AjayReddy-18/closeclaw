import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import type { BotAdapter } from "@closeclaw/bot-adapters";
import type { createMessageProcessor } from "@closeclaw/ai-agent";
import {
  createHeartbeatRunner,
  type HeartbeatRunner,
} from "@closeclaw/ai-agent";
import type { Configuration } from "@closeclaw/shared-types";
import { isValidHeartbeatConfig } from "@closeclaw/shared-types";

function readHeartbeatFile(path: string): () => string | undefined {
  return () => {
    try {
      return readFileSync(path, "utf-8");
    } catch {
      return undefined;
    }
  };
}

export function setupHeartbeat(
  config: Configuration,
  processor: ReturnType<typeof createMessageProcessor>,
  adapters: BotAdapter[],
): HeartbeatRunner | undefined {
  const hb = config.heartbeat;
  if (!hb || !hb.enabled || !isValidHeartbeatConfig(hb)) return undefined;
  if (adapters.length === 0) return undefined;
  const adapter = adapters[0];
  const baseDir = join(homedir(), ".closeclaw");
  const heartbeatPath = join(baseDir, "HEARTBEAT.md");
  const firstPlatform = adapter.platform;
  const lastSender = { id: "" };
  adapter.onMessage((msg) => {
    lastSender.id = msg.senderId;
  });
  return createHeartbeatRunner(
    hb,
    (prompt) => processor.processMessage(firstPlatform, lastSender.id, prompt),
    (text) => adapter.sendMessage(lastSender.id, text),
    readHeartbeatFile(heartbeatPath),
  );
}
