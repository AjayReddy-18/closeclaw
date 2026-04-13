import type { SendResult } from "./adapter.js";

const DEFAULT_THROTTLE_MS = 2000;

export interface LiveMessageDeps {
  sendMessage: (text: string) => Promise<SendResult | void>;
  editMessage: (messageId: number | string, text: string) => Promise<boolean>;
  throttleMs?: number;
}

export interface LiveMessage {
  update(text: string): void;
  finalize(text: string, extraChunks?: string[]): Promise<void>;
  reset(): void;
  dispose(): void;
}

export function createLiveMessage(deps: LiveMessageDeps): LiveMessage {
  const throttleMs = deps.throttleMs ?? DEFAULT_THROTTLE_MS;
  let messageId: number | string | undefined;
  let pendingText: string | null = null;
  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastEditAt = 0;
  let active = true;
  let fallbackMode = false;
  let sendingFirst = false;
  let firstSendPromise: Promise<void> | null = null;

  function clearThrottle(): void {
    if (throttleTimer !== null) {
      clearTimeout(throttleTimer);
      throttleTimer = null;
    }
  }

  async function doEdit(text: string): Promise<boolean> {
    if (!messageId || fallbackMode) return false;
    try {
      const ok = await deps.editMessage(messageId, text);
      if (ok) {
        lastEditAt = Date.now();
        return true;
      }
      fallbackMode = true;
      return false;
    } catch {
      fallbackMode = true;
      return false;
    }
  }

  async function doSendNew(text: string): Promise<void> {
    await deps.sendMessage(text).catch(() => {});
  }

  function scheduleFlush(): void {
    if (throttleTimer !== null) return;
    const elapsed = Date.now() - lastEditAt;
    const delay = Math.max(0, throttleMs - elapsed);
    throttleTimer = setTimeout(() => {
      throttleTimer = null;
      void flushPending();
    }, delay);
  }

  async function flushPending(): Promise<void> {
    const text = pendingText;
    pendingText = null;
    if (!text || !active) return;
    const edited = await doEdit(text);
    if (!edited) await doSendNew(text);
  }

  function handleFirstSend(text: string): void {
    sendingFirst = true;
    firstSendPromise = deps
      .sendMessage(text)
      .then((result) => {
        if (result?.messageId) {
          messageId = result.messageId;
        } else {
          fallbackMode = true;
        }
        lastEditAt = Date.now();
      })
      .catch(() => {
        fallbackMode = true;
      })
      .finally(() => {
        sendingFirst = false;
      });
  }

  function update(text: string): void {
    if (!active) return;
    if (!messageId && !sendingFirst) {
      handleFirstSend(text);
      return;
    }
    pendingText = text;
    scheduleFlush();
  }

  async function finalize(text: string, extraChunks?: string[]): Promise<void> {
    clearThrottle();
    pendingText = null;
    if (firstSendPromise) await firstSendPromise;
    if (messageId && !fallbackMode) {
      const edited = await doEdit(text);
      if (!edited) await doSendNew(text);
    } else {
      await doSendNew(text);
    }
    if (extraChunks) {
      for (const chunk of extraChunks) {
        await doSendNew(chunk);
      }
    }
    active = false;
  }

  function reset(): void {
    clearThrottle();
    pendingText = null;
    messageId = undefined;
    fallbackMode = false;
    sendingFirst = false;
    firstSendPromise = null;
    lastEditAt = 0;
  }

  function dispose(): void {
    clearThrottle();
    active = false;
  }

  return { update, finalize, reset, dispose };
}
