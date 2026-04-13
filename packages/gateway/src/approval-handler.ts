import type { BotAdapter } from "@closeclaw/bot-adapters";

const APPROVAL_TIMEOUT_MS = 120_000;

const pendingDecisions = new Map<
  string,
  (decision: "accept" | "deny") => void
>();

function resolveDecision(
  senderId: string,
  decision: "accept" | "deny" | null,
): boolean {
  if (!decision) return false;
  const resolver = pendingDecisions.get(senderId);
  if (!resolver) return false;
  resolver(decision);
  pendingDecisions.delete(senderId);
  return true;
}

function textToDecision(text: string): "accept" | "deny" | null {
  const lower = text.trim().toLowerCase();
  if (lower === "accept" || lower === "yes" || lower === "y") return "accept";
  if (lower === "deny" || lower === "no" || lower === "n") return "deny";
  return null;
}

export function resolvePermission(senderId: string, text: string): boolean {
  return resolveDecision(senderId, textToDecision(text));
}

export function resolveCallbackDecision(
  senderId: string,
  data: string,
): boolean {
  if (data === "approval_accept") return resolveDecision(senderId, "accept");
  if (data === "approval_deny") return resolveDecision(senderId, "deny");
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

const APPROVAL_BUTTONS = [
  [
    { text: "Accept", callbackData: "approval_accept" },
    { text: "Deny", callbackData: "approval_deny" },
  ],
];

async function sendWithButtons(
  adapter: BotAdapter,
  senderId: string,
  text: string,
): Promise<void> {
  if (adapter.sendMessageWithButtons) {
    await adapter.sendMessageWithButtons(senderId, text, APPROVAL_BUTTONS);
  } else {
    await adapter.sendMessage(senderId, `${text}\n\nReply Accept or Deny`);
  }
}

export function createPermissionAsker(
  adapter: BotAdapter,
  senderId: string,
  onSent?: () => void,
): (prompt: string) => Promise<"accept" | "deny"> {
  return async (prompt) => {
    await sendWithButtons(adapter, senderId, prompt);
    onSent?.();
    return waitForDecision(adapter, senderId);
  };
}

export function createApprovalAsker(
  adapter: BotAdapter,
  senderId: string,
  onSent?: () => void,
): (
  rejected: Array<{ command: string; description: string }>,
) => Promise<"approve" | "deny"> {
  return async (rejected) => {
    const cmds = rejected.map((r) => `  • ${r.command}`).join("\n");
    await sendWithButtons(
      adapter,
      senderId,
      `Cursor needs approval to run:\n${cmds}`,
    );
    onSent?.();
    const d = await waitForDecision(adapter, senderId);
    return d === "accept" ? "approve" : "deny";
  };
}
