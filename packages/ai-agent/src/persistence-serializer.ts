import type { BotPlatform } from "@closeclaw/shared-types";
import type {
  Conversation,
  CompressedSummary,
  ConversationMessage,
} from "./conversation-types.js";
import type {
  ConversationFileData,
  ConversationFileMessage,
  CompressedSummaryData,
} from "./persistence-types.js";

export function messageToFile(m: ConversationMessage): ConversationFileMessage {
  return {
    role: m.role,
    content: m.content,
    timestamp: m.timestamp.toISOString(),
    ...(m.toolCallId ? { toolCallId: m.toolCallId } : {}),
    ...(m.toolName ? { toolName: m.toolName } : {}),
  };
}

export function messageFromFile(m: ConversationFileMessage): ConversationMessage {
  return {
    role: m.role,
    content: m.content,
    timestamp: new Date(m.timestamp),
    ...(m.toolCallId ? { toolCallId: m.toolCallId } : {}),
    ...(m.toolName ? { toolName: m.toolName } : {}),
  };
}

export function summaryToFile(s: CompressedSummary): CompressedSummaryData {
  return {
    text: s.text,
    messagesCompressed: s.messagesCompressed,
    compressedAt: s.compressedAt.toISOString(),
  };
}

export function summaryFromFile(s: CompressedSummaryData): CompressedSummary {
  return {
    text: s.text,
    messagesCompressed: s.messagesCompressed,
    compressedAt: new Date(s.compressedAt),
  };
}

export function conversationToFile(c: Conversation): ConversationFileData {
  return {
    platform: c.platform,
    senderId: c.senderId,
    ...(c.senderDisplayName ? { senderDisplayName: c.senderDisplayName } : {}),
    ...(c.compressedSummary
      ? { compressedSummary: summaryToFile(c.compressedSummary) }
      : {}),
    messages: c.messages.map(messageToFile),
    createdAt: c.createdAt.toISOString(),
    lastActivityAt: c.lastActivityAt.toISOString(),
  };
}

export function conversationFromFile(
  data: ConversationFileData,
): Conversation {
  return {
    platform: data.platform as BotPlatform,
    senderId: data.senderId,
    ...(data.senderDisplayName
      ? { senderDisplayName: data.senderDisplayName }
      : {}),
    ...(data.compressedSummary
      ? { compressedSummary: summaryFromFile(data.compressedSummary) }
      : {}),
    messages: data.messages.map(messageFromFile),
    createdAt: new Date(data.createdAt),
    lastActivityAt: new Date(data.lastActivityAt),
  };
}
