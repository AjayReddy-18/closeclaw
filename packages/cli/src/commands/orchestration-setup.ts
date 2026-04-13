import type {
  BotAdapter,
  IncomingMessage as BotIncomingMessage,
} from "@closeclaw/bot-adapters";
import { createLiveMessage } from "@closeclaw/bot-adapters";
import {
  runOrchestration,
  type OrchestrationDeps,
} from "@closeclaw/orchestrator";
import type { GatewayServerConfig } from "@closeclaw/gateway";
import { randomUUID } from "node:crypto";

type Processor = NonNullable<GatewayServerConfig["messageProcessor"]>;

function buildSubtaskPlans(tasks: Array<{ label: string; prompt: string }>) {
  return tasks.map((task) => ({
    id: randomUUID().slice(0, 8),
    label: task.label,
    prompt: task.prompt,
  }));
}

function buildLiveFactory(adapter: BotAdapter, senderId: string) {
  return () =>
    createLiveMessage({
      sendMessage: (text) => adapter.sendMessage(senderId, text),
      editMessage: adapter.editMessage
        ? (msgId, text) => adapter.editMessage!(senderId, msgId, text)
        : async () => false,
    });
}

export function createOrchestrationRunner(processor: Processor) {
  return async (
    adapter: BotAdapter,
    msg: BotIncomingMessage,
    tasks: Array<{ label: string; prompt: string }>,
    _processor: Processor,
  ): Promise<string> => {
    const deps: OrchestrationDeps = {
      processMessage: (platform, senderId, text, displayName, onIntermediate) =>
        processor.processMessage(
          platform,
          senderId,
          text,
          displayName,
          onIntermediate,
        ),
      createLiveMessage: buildLiveFactory(adapter, msg.senderId),
      sendSummary: (text) => adapter.sendMessage(msg.senderId, text),
    };

    const session = {
      senderId: msg.senderId,
      platform: msg.platform,
      senderDisplayName: msg.senderDisplayName,
      subtasks: buildSubtaskPlans(tasks),
    };

    return runOrchestration(session, deps);
  };
}
