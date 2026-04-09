import type {
  BotAdapter,
  IncomingMessage as BotIncomingMessage,
} from "@closeclaw/bot-adapters";
import type { GatewayServerConfig } from "./gateway-server.js";

const GATEWAY_PROCESSING_FAILED =
  "I'm having trouble thinking right now. Please try again in a moment.";

const PROCESSING_ACK_DELAY_MS = 5000;

const STILL_WORKING_DELAY_MS = 30_000;

const TYPING_INTERVAL_MS = 4000;

const senderQueues = new Map<string, Promise<void>>();

function safeTask(task: () => Promise<void>): () => Promise<void> {
  return () =>
    task().catch((err) => console.error("[gateway] Queued task failed:", err));
}

export function enqueueForSender(key: string, task: () => Promise<void>): void {
  const prev = senderQueues.get(key) ?? Promise.resolve();
  const safe = safeTask(task);
  const next = prev.then(safe, safe);
  senderQueues.set(key, next);
}

function startTypingLoop(adapter: BotAdapter, senderId: string): () => void {
  const send = () =>
    void Promise.resolve(adapter.sendTypingIndicator(senderId)).catch(() => {});
  send();
  const id = setInterval(send, TYPING_INTERVAL_MS);
  return () => clearInterval(id);
}

function scheduleProcessingAck(
  adapter: BotAdapter,
  senderId: string,
): NodeJS.Timeout {
  return setTimeout(() => {
    void adapter
      .sendMessage(senderId, "Processing your message...")
      .catch(() => {});
  }, PROCESSING_ACK_DELAY_MS);
}

function scheduleStillWorkingReminder(
  adapter: BotAdapter,
  senderId: string,
): NodeJS.Timeout {
  return setTimeout(() => {
    void adapter
      .sendMessage(senderId, "Still working on it...")
      .catch(() => {});
  }, STILL_WORKING_DELAY_MS);
}

export async function runAgentResponse(
  adapter: BotAdapter,
  processor: NonNullable<GatewayServerConfig["messageProcessor"]>,
  msg: BotIncomingMessage,
): Promise<void> {
  const stopTyping = startTypingLoop(adapter, msg.senderId);
  const processingTimer = scheduleProcessingAck(adapter, msg.senderId);
  const stillWorkingTimer = scheduleStillWorkingReminder(adapter, msg.senderId);

  let ackCleared = false;
  function clearAckOnce(): void {
    if (ackCleared) return;
    ackCleared = true;
    clearTimeout(processingTimer);
    if (stillWorkingTimer) clearTimeout(stillWorkingTimer);
  }

  const onIntermediate = async (text: string): Promise<void> => {
    clearAckOnce();
    await adapter.sendMessage(msg.senderId, text);
    adapter.sendTypingIndicator(msg.senderId).catch(() => {});
  };

  try {
    const response = await processor.processMessage(
      msg.platform,
      msg.senderId,
      msg.text,
      msg.senderDisplayName,
      onIntermediate,
    );
    clearAckOnce();
    stopTyping();
    await adapter.sendMessage(msg.senderId, response);
  } catch (error) {
    console.error("[gateway] Message processing failed:", error);
    clearAckOnce();
    stopTyping();
    await adapter
      .sendMessage(msg.senderId, GATEWAY_PROCESSING_FAILED)
      .catch((sendErr) =>
        console.error("[gateway] Failed to send error reply:", sendErr),
      );
  }
}

export function logAcceptedMessage(msg: BotIncomingMessage): void {
  const sender = msg.senderDisplayName ?? msg.senderId;
  console.log(`[${msg.platform}] Message from ${sender}: ${msg.text}`);
}

export function formatPairingReply(pairingCode: string): string {
  return `Pairing code: ${pairingCode}\nAsk the owner to run: closeclaw pairing approve ${pairingCode}`;
}

export async function maybeSendPairingReply(
  adapter: BotAdapter,
  allowed: boolean,
  pairingCode: string | undefined,
  senderId: string,
): Promise<void> {
  if (allowed || pairingCode === undefined) return;
  await adapter.sendMessage(senderId, formatPairingReply(pairingCode));
}
