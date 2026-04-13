import type { BotPlatform } from "@closeclaw/shared-types";
import type { LiveMessage, SendResult } from "@closeclaw/bot-adapters";

export interface SubtaskPlan {
  id: string;
  label: string;
  prompt: string;
}

export interface SubtaskResult {
  id: string;
  label: string;
  status: "fulfilled" | "rejected";
  response?: string;
  error?: string;
}

export interface OrchestrationSession {
  senderId: string;
  platform: BotPlatform;
  senderDisplayName?: string;
  subtasks: SubtaskPlan[];
}

export interface ProcessMessageFn {
  (
    platform: BotPlatform,
    senderId: string,
    text: string,
    senderDisplayName?: string,
    onIntermediateResponse?: (text: string) => Promise<void>,
  ): Promise<string>;
}

export interface LiveMessageFactory {
  (): LiveMessage;
}

export interface OrchestrationDeps {
  processMessage: ProcessMessageFn;
  createLiveMessage: LiveMessageFactory;
  sendSummary: (text: string) => Promise<SendResult | void>;
  approvalAsk?: ApprovalAskFn;
}

export type ApprovalAskFn = (
  taskId: string,
  items: Array<{ command: string; description: string }>,
) => Promise<"approve" | "deny">;

export interface SubtaskRunnerDeps {
  processMessage: ProcessMessageFn;
  platform: BotPlatform;
  senderId: string;
  senderDisplayName?: string;
}

export interface ApprovalQueue {
  enqueue(
    taskId: string,
    items: Array<{ command: string; description: string }>,
  ): Promise<"approve" | "deny">;
  dispose(): void;
}
