import { PROGRESS_THROTTLE_MS, HEARTBEAT_SILENCE_MS } from "./types.js";

export interface ProgressThrottle {
  onOutput(text: string): void;
  startHeartbeat(): void;
  stopHeartbeat(): void;
}

export function createProgressThrottle(
  send: (text: string) => void,
  throttleMs = PROGRESS_THROTTLE_MS,
  silenceMs = HEARTBEAT_SILENCE_MS,
): ProgressThrottle {
  let lastSentAt = 0;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let lastActivityAt = Date.now();

  function resetActivity(): void {
    lastActivityAt = Date.now();
  }

  return {
    onOutput(text) {
      resetActivity();
      const now = Date.now();
      if (now - lastSentAt < throttleMs) return;
      lastSentAt = now;
      send(text);
    },

    startHeartbeat() {
      resetActivity();
      heartbeatTimer = setInterval(() => {
        if (Date.now() - lastActivityAt >= silenceMs) {
          send("Still working on the task...");
          resetActivity();
        }
      }, silenceMs);
    },

    stopHeartbeat() {
      if (heartbeatTimer !== undefined) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = undefined;
      }
    },
  };
}
