import type { HeartbeatConfig, ActiveHours } from "@closeclaw/shared-types";
import { parseDuration } from "./duration-parser.js";

const HEARTBEAT_OK_TOKEN = "HEARTBEAT_OK";

export interface HeartbeatRunner {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  runNow(): Promise<void>;
}

function isWithinActiveHours(hours: ActiveHours | undefined): boolean {
  if (!hours) return true;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return hhmm >= hours.start && hhmm <= hours.end;
}

function shouldSuppressResponse(response: string): boolean {
  const trimmed = response.trim();
  return (
    trimmed.startsWith(HEARTBEAT_OK_TOKEN) ||
    trimmed.endsWith(HEARTBEAT_OK_TOKEN)
  );
}

export function createHeartbeatRunner(
  config: HeartbeatConfig,
  processMessage: (prompt: string) => Promise<string>,
  sendMessage: (text: string) => Promise<void>,
  readHeartbeatFile: () => string | undefined,
): HeartbeatRunner {
  let intervalId: ReturnType<typeof setInterval> | undefined;

  async function fire(): Promise<void> {
    if (config.target === "none") return;
    if (!isWithinActiveHours(config.activeHours)) return;
    const content = readHeartbeatFile();
    if (!content) return;
    try {
      const prompt = `[HEARTBEAT CHECK]\n${content}`;
      const response = await processMessage(prompt);
      if (!shouldSuppressResponse(response)) {
        await sendMessage(response);
      }
    } catch (err) {
      console.error("[heartbeat] Error during heartbeat:", err);
    }
  }

  return {
    start() {
      if (intervalId !== undefined) return;
      const ms = parseDuration(config.every) ?? 1_800_000;
      intervalId = setInterval(() => void fire(), ms);
    },

    stop() {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    },

    isRunning: () => intervalId !== undefined,

    runNow: () => fire(),
  };
}
