export interface ConversationFileMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  timestamp: string;
  toolCallId?: string;
  toolName?: string;
}

export interface CompressedSummaryData {
  text: string;
  messagesCompressed: number;
  compressedAt: string;
}

export interface ConversationFileData {
  platform: string;
  senderId: string;
  senderDisplayName?: string;
  compressedSummary?: CompressedSummaryData;
  messages: ConversationFileMessage[];
  createdAt: string;
  lastActivityAt: string;
}

export interface PreferenceEntry {
  key: string;
  value: string;
  updatedAt: string;
}

export interface PreferenceFileData {
  platform: string;
  senderId: string;
  preferences: PreferenceEntry[];
  lastModifiedAt: string;
}
