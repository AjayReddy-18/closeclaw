import type {
  BotAdapter,
  IncomingMessage as BotIncomingMessage,
} from "@closeclaw/bot-adapters";
import { createLiveMessage, type LiveMessage } from "@closeclaw/bot-adapters";
import type { GatewayServerConfig } from "./gateway-server.js";
import {
  createPermissionAsker,
  createApprovalAsker,
} from "./approval-handler.js";

export {
  resolvePermission,
  resolveCallbackDecision,
  createPermissionAsker,
  createApprovalAsker,
} from "./approval-handler.js";

const GATEWAY_PROCESSING_FAILED =
  "I'm having trouble thinking right now. Please try again in a moment.";

const TYPING_INTERVAL_MS = 4000;
const senderQueues = new Map<string, Promise<void>>();

export interface ToolProgressRef {
  send: (text: string) => void;
}

export interface PermissionRef {
  ask: (prompt: string) => Promise<"accept" | "deny">;
}

export interface ApprovalRef {
  ask: (
    rejected: Array<{ command: string; description: string }>,
  ) => Promise<"approve" | "deny">;
}

export interface OrchestrationPlanRef {
  plan: { tasks: Array<{ label: string; prompt: string }> } | null;
}

export type OrchestrationRunner = (
  adapter: BotAdapter,
  msg: BotIncomingMessage,
  tasks: Array<{ label: string; prompt: string }>,
  processor: NonNullable<GatewayServerConfig["messageProcessor"]>,
) => Promise<string>;

export function enqueueForSender(key: string, task: () => Promise<void>): void {
  const prev = senderQueues.get(key) ?? Promise.resolve();
  const safe = () =>
    task().catch((err) => console.error("[gateway] Queued task failed:", err));
  senderQueues.set(key, prev.then(safe, safe));
}

function startTypingLoop(adapter: BotAdapter, senderId: string): () => void {
  const tick = () =>
    void Promise.resolve(adapter.sendTypingIndicator(senderId)).catch(() => {});
  tick();
  const id = setInterval(tick, TYPING_INTERVAL_MS);
  return () => clearInterval(id);
}

function buildLiveMessage(adapter: BotAdapter, senderId: string): LiveMessage {
  return createLiveMessage({
    sendMessage: (text) => adapter.sendMessage(senderId, text),
    editMessage: adapter.editMessage
      ? (msgId, text) => adapter.editMessage!(senderId, msgId, text)
      : async () => false,
  });
}

export async function runAgentResponse(
  adapter: BotAdapter,
  processor: NonNullable<GatewayServerConfig["messageProcessor"]>,
  msg: BotIncomingMessage,
  progressRef?: ToolProgressRef,
  permissionRef?: PermissionRef,
  approvalRef?: ApprovalRef,
  orchestrationPlanRef?: OrchestrationPlanRef,
  orchestrationRunner?: OrchestrationRunner,
): Promise<void> {
  const stopTyping = startTypingLoop(adapter, msg.senderId);
  const live = buildLiveMessage(adapter, msg.senderId);
  live.update("Thinking...");
  if (orchestrationPlanRef) orchestrationPlanRef.plan = null;

  if (progressRef) progressRef.send = (text) => live.update(text);
  const resetLive = () => live.reset();
  if (permissionRef)
    permissionRef.ask = createPermissionAsker(adapter, msg.senderId, resetLive);
  if (approvalRef)
    approvalRef.ask = createApprovalAsker(adapter, msg.senderId, resetLive);

  try {
    const response = await processor.processMessage(
      msg.platform,
      msg.senderId,
      msg.text,
      msg.senderDisplayName,
      async (text: string) => {
        await live.finalize(text);
        live.reset();
      },
    );
    stopTyping();

    if (orchestrationPlanRef?.plan && orchestrationRunner) {
      await live.finalize("Running tasks in parallel...");
      live.dispose();
      const summary = await orchestrationRunner(
        adapter,
        msg,
        orchestrationPlanRef.plan.tasks,
        processor,
      );
      return void summary;
    }

    await live.finalize(response || GATEWAY_PROCESSING_FAILED);
  } catch (error) {
    console.error("[gateway] Message processing failed:", error);
    stopTyping();
    await live
      .finalize(GATEWAY_PROCESSING_FAILED)
      .catch((e) => console.error("[gateway] Failed to send error reply:", e));
  } finally {
    live.dispose();
    if (progressRef) progressRef.send = () => {};
    if (permissionRef) permissionRef.ask = async () => "deny";
    if (approvalRef) approvalRef.ask = async () => "deny";
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
