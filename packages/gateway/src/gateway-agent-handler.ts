import type {
  BotAdapter,
  IncomingMessage as BotIncomingMessage,
} from "@closeclaw/bot-adapters";
import type { GatewayServerConfig } from "./gateway-server.js";

const GATEWAY_PROCESSING_FAILED =
  "I'm having trouble thinking right now. Please try again in a moment.";

const TYPING_INTERVAL_MS = 4000;
const APPROVAL_TIMEOUT_MS = 120_000;

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

const pendingDecisions = new Map<
  string,
  (decision: "accept" | "deny") => void
>();

export function resolvePermission(senderId: string, text: string): boolean {
  const resolver = pendingDecisions.get(senderId);
  if (!resolver) return false;
  const lower = text.trim().toLowerCase();
  if (lower === "accept" || lower === "yes" || lower === "y") {
    resolver("accept");
    pendingDecisions.delete(senderId);
    return true;
  }
  if (lower === "deny" || lower === "no" || lower === "n") {
    resolver("deny");
    pendingDecisions.delete(senderId);
    return true;
  }
  return false;
}

export function resolveCallbackDecision(
  senderId: string,
  data: string,
): boolean {
  const resolver = pendingDecisions.get(senderId);
  if (!resolver) return false;
  if (data === "approval_accept") {
    resolver("accept");
    pendingDecisions.delete(senderId);
    return true;
  }
  if (data === "approval_deny") {
    resolver("deny");
    pendingDecisions.delete(senderId);
    return true;
  }
  return false;
}

function waitForDecision(
  adapter: BotAdapter,
  senderId: string,
): Promise<"accept" | "deny"> {
  return new Promise<"accept" | "deny">((resolve) => {
    const timer = setTimeout(() => {
      pendingDecisions.delete(senderId);
      adapter
        .sendMessage(senderId, "Permission timed out — auto-denied.")
        .catch(() => {});
      resolve("deny");
    }, APPROVAL_TIMEOUT_MS);
    pendingDecisions.set(senderId, (decision) => {
      clearTimeout(timer);
      resolve(decision);
    });
  });
}

export function createPermissionAsker(
  adapter: BotAdapter,
  senderId: string,
): (prompt: string) => Promise<"accept" | "deny"> {
  return async (prompt) => {
    const buttons = [
      [
        { text: "Accept", callbackData: "approval_accept" },
        { text: "Deny", callbackData: "approval_deny" },
      ],
    ];
    if (adapter.sendMessageWithButtons) {
      await adapter.sendMessageWithButtons(senderId, prompt, buttons);
    } else {
      await adapter.sendMessage(senderId, `${prompt}\n\nReply Accept or Deny`);
    }
    return waitForDecision(adapter, senderId);
  };
}

export function createApprovalAsker(
  adapter: BotAdapter,
  senderId: string,
): (
  rejected: Array<{ command: string; description: string }>,
) => Promise<"approve" | "deny"> {
  return async (rejected) => {
    const cmds = rejected.map((r) => `  • ${r.command}`).join("\n");
    const text = `Cursor needs approval to run:\n${cmds}`;
    const buttons = [
      [
        { text: "Accept", callbackData: "approval_accept" },
        { text: "Deny", callbackData: "approval_deny" },
      ],
    ];
    if (adapter.sendMessageWithButtons) {
      await adapter.sendMessageWithButtons(senderId, text, buttons);
    } else {
      await adapter.sendMessage(senderId, `${text}\n\nReply Accept or Deny`);
    }
    return waitForDecision(adapter, senderId).then((d) =>
      d === "accept" ? "approve" : "deny",
    );
  };
}

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

export async function runAgentResponse(
  adapter: BotAdapter,
  processor: NonNullable<GatewayServerConfig["messageProcessor"]>,
  msg: BotIncomingMessage,
  progressRef?: ToolProgressRef,
  permissionRef?: PermissionRef,
  approvalRef?: ApprovalRef,
): Promise<void> {
  const stopTyping = startTypingLoop(adapter, msg.senderId);
  const sendToUser = async (text: string): Promise<void> => {
    await adapter.sendMessage(msg.senderId, text);
    adapter.sendTypingIndicator(msg.senderId).catch(() => {});
  };

  if (progressRef) progressRef.send = (text) => void sendToUser(text);
  if (permissionRef)
    permissionRef.ask = createPermissionAsker(adapter, msg.senderId);
  if (approvalRef) approvalRef.ask = createApprovalAsker(adapter, msg.senderId);

  try {
    const response = await processor.processMessage(
      msg.platform,
      msg.senderId,
      msg.text,
      msg.senderDisplayName,
      async (text: string) => {
        await sendToUser(text);
      },
    );
    stopTyping();
    await adapter.sendMessage(msg.senderId, response);
  } catch (error) {
    console.error("[gateway] Message processing failed:", error);
    stopTyping();
    await adapter
      .sendMessage(msg.senderId, GATEWAY_PROCESSING_FAILED)
      .catch((e) => console.error("[gateway] Failed to send error reply:", e));
  } finally {
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
