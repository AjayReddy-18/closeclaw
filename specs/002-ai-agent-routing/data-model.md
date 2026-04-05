# Data Model: AI Agent Routing

**Feature**: 002-ai-agent-routing
**Date**: 2026-04-05

## New Types in `@closeclaw/shared-types`

### AiProvider

```typescript
export const AI_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "ollama",
  "kimi",
  "custom",
] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];
```

Providers that require an API key: `openai`, `anthropic`, `google`, `kimi`.
Providers that require a base URL: `ollama` (default `http://localhost:11434`), `custom`.

### ToolConfig

```typescript
export interface ToolConfig {
  enabled: boolean;
  allowedTools: ToolName[];
  maxCallDepth: number;
  timeoutMs: number;
}

export const TOOL_NAMES = [
  "datetime",
  "http_request",
  "shell_execute",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const DEFAULT_TOOL_CONFIG: ToolConfig = {
  enabled: false,
  allowedTools: [],
  maxCallDepth: 10,
  timeoutMs: 30_000,
};
```

### AgentConfig

```typescript
export interface AgentConfig {
  provider: AiProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  systemPrompt: string;
  maxContextTokens: number;
  tools: ToolConfig;
}

export const DEFAULT_SYSTEM_PROMPT =
  "You are CloseClaw, a helpful AI assistant.";
export const DEFAULT_MAX_CONTEXT_TOKENS = 8192;
```

### Extended Configuration

The existing `Configuration` interface gains an optional `agent` field:

```typescript
export interface Configuration {
  version: string;
  lastModified: string;
  channels: Partial<Record<BotPlatform, BotIntegration>>;
  gateway: GatewayConfig;
  agent?: AgentConfig;
}
```

## New Types in `@closeclaw/ai-agent`

### ConversationRole

```typescript
export type ConversationRole = "system" | "user" | "assistant" | "tool";
```

### ConversationMessage

```typescript
export interface ConversationMessage {
  role: ConversationRole;
  content: string;
  timestamp: Date;
  toolCallId?: string;
  toolName?: string;
}
```

### Conversation

```typescript
export interface Conversation {
  platform: BotPlatform;
  senderId: string;
  senderDisplayName?: string;
  messages: ConversationMessage[];
  createdAt: Date;
  lastActivityAt: Date;
}
```

### ConversationSummary

```typescript
export interface ConversationSummary {
  platform: BotPlatform;
  senderId: string;
  senderDisplayName?: string;
  messageCount: number;
  lastActivityAt: Date;
}
```

### ConversationStore

```typescript
export interface ConversationStore {
  getOrCreate(
    platform: BotPlatform,
    senderId: string,
    senderDisplayName?: string,
  ): Conversation;
  get(platform: BotPlatform, senderId: string): Conversation | undefined;
  clear(platform: BotPlatform, senderId: string): boolean;
  list(): ConversationSummary[];
  pruneStale(maxAgeMs: number): number;
  size(): number;
}
```

### MessageProcessor

```typescript
export interface MessageProcessor {
  processMessage(
    platform: BotPlatform,
    senderId: string,
    text: string,
    senderDisplayName?: string,
  ): Promise<string>;
}
```

### MessageProcessorConfig

```typescript
export interface MessageProcessorConfig {
  agentConfig: AgentConfig;
  conversationStore: ConversationStore;
}
```

## Updated Types in `@closeclaw/bot-adapters`

### BotAdapter (extended)

```typescript
export interface BotAdapter {
  readonly platform: BotPlatform;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<BotHealthResult>;
  onMessage(handler: MessageHandler): void;
  sendMessage(senderId: string, text: string): Promise<void>;
  sendTypingIndicator(senderId: string): Promise<void>; // NEW
}
```

## Updated Types in `@closeclaw/gateway`

### GatewayServerConfig (extended)

```typescript
export type GatewayServerConfig = {
  port: number;
  authToken: string;
  adapters: BotAdapter[];
  pairingStorePath?: string;
  getDmSettings?: (platform: BotPlatform) => {
    dmPolicy: DmPolicy;
    allowedSenders?: string[];
  };
  messageProcessor?: MessageProcessor; // NEW
};
```

## JSON Configuration Shape

Example `~/.closeclaw/closeclaw.json` after agent configuration:

```json
{
  "version": "0.2.0",
  "lastModified": "2026-04-05T12:00:00.000Z",
  "channels": {
    "telegram": {
      "token": "123456:ABC-DEF...",
      "dmPolicy": "pairing",
      "enabled": true
    }
  },
  "gateway": {
    "bindAddress": "127.0.0.1",
    "port": 7337,
    "authToken": "auto-generated-token-here..."
  },
  "agent": {
    "provider": "ollama",
    "model": "llama3.2",
    "baseUrl": "http://localhost:11434",
    "systemPrompt": "You are CloseClaw, a helpful AI assistant.",
    "maxContextTokens": 8192,
    "tools": {
      "enabled": true,
      "allowedTools": ["datetime", "http_request"],
      "maxCallDepth": 10,
      "timeoutMs": 30000
    }
  }
}
```

## Relationships

```text
Configuration ──has-optional──▶ AgentConfig
AgentConfig ──has──▶ ToolConfig
ConversationStore ──contains-many──▶ Conversation
Conversation ──contains-many──▶ ConversationMessage
MessageProcessor ──uses──▶ ConversationStore
MessageProcessor ──uses──▶ AgentConfig (via provider-factory)
GatewayServerConfig ──has-optional──▶ MessageProcessor
```
