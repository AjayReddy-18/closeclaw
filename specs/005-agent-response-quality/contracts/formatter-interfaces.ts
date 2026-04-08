/**
 * Contract interfaces for the response formatting and suppression pipeline.
 * These are design-time contracts, not runtime code.
 */

// --- Response Formatting ---

export interface FormatterResult {
  text: string;
  parseMode: "HTML" | undefined;
}

export interface MessageChunk {
  text: string;
  parseMode: "HTML" | undefined;
}

export interface ResponseFormatter {
  format(markdown: string): FormatterResult;
  split(formatted: FormatterResult, maxLength: number): MessageChunk[];
}

// --- Suppression Filter ---

export interface SuppressionResult {
  shouldDeliver: boolean;
  reason: string;
  cleanedResponse: string | undefined;
}

export interface SuppressionContext {
  taskId: string;
  lastDeliveredAt: string | undefined;
  safetyValveMinutes: number;
}

export type SuppressionFilter = (
  response: string,
  context: SuppressionContext,
) => SuppressionResult;

// --- System Prompt ---

export interface SystemPromptParts {
  builtInPrompt: string;
  userCustomPrompt: string | undefined;
  senderIdentity: string | undefined;
  preferenceContext: string | undefined;
  conversationSummary: string | undefined;
}

export type SystemPromptBuilder = (parts: SystemPromptParts) => string;

// --- BotAdapter.sendMessage (extended) ---

export interface FormattedSendOptions {
  parseMode?: "HTML";
}

export interface FormattedBotAdapter {
  sendMessage(
    senderId: string,
    text: string,
    options?: FormattedSendOptions,
  ): Promise<void>;
}
