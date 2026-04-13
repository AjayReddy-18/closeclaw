import { homedir } from "node:os";
import { join } from "node:path";
import {
  createMessageProcessor,
  createPersistentConversationStore,
  createConversationPersistence,
  createConversationCompressor,
  createPreferenceStore,
  createMemoryFlusher,
  createModelProvider,
  type CreateMessageProcessorDeps,
} from "@closeclaw/ai-agent";
import {
  DEFAULT_COMPRESSION_THRESHOLD,
  DEFAULT_KEEP_RECENT_COUNT,
  type AgentConfig,
} from "@closeclaw/shared-types";

export interface AgentAssemblyResult {
  conversationStore: ReturnType<typeof createPersistentConversationStore>;
  messageProcessor: ReturnType<typeof createMessageProcessor>;
}

export function assembleAgent(
  agent: AgentConfig,
  extraTools?: Record<string, unknown>,
  mcpToolNames?: string[],
  hasCursorAgent?: boolean,
  hasOrchestration?: boolean,
): AgentAssemblyResult {
  const baseDir = join(homedir(), ".closeclaw");
  const persistence = createConversationPersistence(
    join(baseDir, "conversations"),
  );
  const prefStore = createPreferenceStore(join(baseDir, "preferences"));
  const threshold = agent.compressionThreshold ?? DEFAULT_COMPRESSION_THRESHOLD;
  const keepRecent = agent.keepRecentCount ?? DEFAULT_KEEP_RECENT_COUNT;
  const model = createModelProvider(agent);
  const compressor = createConversationCompressor(threshold, keepRecent, model);
  const flusher = createMemoryFlusher(prefStore, model);
  const conversationStore = createPersistentConversationStore({
    persistence,
    compressor,
    flusher,
  });
  const messageProcessor = createMessageProcessor({
    agentConfig: agent,
    conversationStore,
    preferenceStore: prefStore,
    onAfterResponse: (p, s) => conversationStore.saveToDisk(p, s),
    extraTools: extraTools as CreateMessageProcessorDeps["extraTools"],
    mcpToolNames,
    hasCursorAgent,
    hasOrchestration,
  });
  return { conversationStore, messageProcessor };
}
