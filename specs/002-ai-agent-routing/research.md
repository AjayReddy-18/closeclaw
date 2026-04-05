# Research: AI Agent Routing

**Date**: 2026-04-05
**Feature**: 002-ai-agent-routing

## Decision 1: AI Provider Abstraction

**Decision**: Use the Vercel AI SDK (`ai` npm package) with provider-specific adapter packages.

**Rationale**:

- TypeScript-native, production-proven SDK with 4.9M weekly downloads for the OpenAI adapter alone
- Unified `generateText` and `streamText` APIs abstract provider differences behind a single interface
- Native tool calling support with Zod schema validation, `maxSteps` for multi-step agent loops, and `needsApproval` for gated execution
- Provider packages: `@ai-sdk/openai` (v3.0.50), `@ai-sdk/anthropic` (v3.0.64), `@ai-sdk/google` (v3.0.53)
- Ollama integrates via the OpenAI-compatible provider: `@ai-sdk/openai` with a custom `baseURL` pointing to `http://localhost:11434/v1`
- Kimi (Moonshot AI) also integrates via the OpenAI-compatible path: base URL `https://api.moonshot.ai/v1` with standard API key auth
- Custom OpenAI-compatible endpoints use the same mechanism — just change `baseURL` and `apiKey`

**Alternatives considered**:

- **Custom abstraction layer**: Full control but 6+ HTTP integrations to write and maintain; duplicates what AI SDK already provides
- **OpenAI SDK only**: Simpler but loses Anthropic-specific features (extended thinking, tool use conventions), Gemini multimodal, and robust error handling per provider

## Decision 2: Provider Configuration

**Decision**: Store provider config in `~/.closeclaw/closeclaw.json` under an `agent` key. Support 6 providers via 2 integration paths:

| Provider        | Package             | Integration Path                                 |
| --------------- | ------------------- | ------------------------------------------------ |
| OpenAI          | `@ai-sdk/openai`    | Native adapter                                   |
| Anthropic       | `@ai-sdk/anthropic` | Native adapter                                   |
| Google Gemini   | `@ai-sdk/google`    | Native adapter                                   |
| Ollama          | `@ai-sdk/openai`    | OpenAI-compatible (baseURL = localhost:11434/v1) |
| Kimi (Moonshot) | `@ai-sdk/openai`    | OpenAI-compatible (baseURL = api.moonshot.ai/v1) |
| Custom          | `@ai-sdk/openai`    | OpenAI-compatible (user-provided baseURL)        |

**Rationale**: Native adapters for the Big 3 (OpenAI, Anthropic, Gemini) maximize feature support. The remaining providers all expose OpenAI-compatible endpoints, so the `@ai-sdk/openai` package with custom `baseURL` covers them without additional dependencies.

## Decision 3: Tool Calling Scope

**Decision**: Ship all three built-in tools in v1: `datetime`, `http_request`, and `shell_execute`. Shell execution requires explicit enablement via configuration with a security warning during `closeclaw agent configure`.

**Rationale**: The user explicitly chose full tool support. Shell execution is the most powerful automation primitive and aligns with CloseClaw's mission ("eliminate manual intervention"). Gating it behind explicit opt-in mitigates the security risk.

**Safety controls**:

- Tool calling disabled by default; enabled per-tool in config
- `shell_execute` requires a separate `"I understand the risks"` confirmation
- Max tool call depth per turn (default: 10) prevents infinite loops
- Tool timeout (default: 30 seconds) prevents hung executions

## Decision 4: Response Delivery Pattern

**Decision**: Typing indicator + batch send. When a message is received, immediately send a typing indicator to the sender. Wait for the full AI response (including any tool call chains), then send the complete response as a single message.

**Rationale**: The user chose Option B. This provides good UX (sender knows the bot is working) without the complexity of streaming edits. Both Telegram (`sendChatAction: typing`) and Discord (`channel.sendTyping()`) support typing indicators natively.

**Implementation**:

1. On approved message received → send typing indicator
2. Forward to AI SDK `generateText` with tools and conversation history
3. If tool calls: execute tools, feed results back, repeat (up to maxSteps)
4. When final text response ready → send to sender via `adapter.sendMessage`
5. If response takes > 5 seconds and includes tool calls → send interim "processing..." message

## Decision 5: Conversation Storage

**Decision**: In-memory only for v1. Conversations stored in a `Map<string, Conversation>` keyed by `platform:senderId`. Gateway restart clears all conversations.

**Rationale**: Spec explicitly states "Conversation history is stored in memory during the gateway's lifetime and not persisted to disk in v1." This is the simplest approach that satisfies requirements. Disk persistence can be added in a future feature.

## Decision 6: New Package Structure

**Decision**: Add a new `packages/ai-agent` package to the existing monorepo. This package contains the model provider factory, conversation manager, tool executor, and agent loop.

**Rationale**: Constitution Principle VI (Modular Architecture) requires new features to start as isolated modules. The AI agent functionality is orthogonal to `gateway` and `bot-adapters` — it processes messages but doesn't know about Telegram or Discord. The gateway orchestrates by passing approved messages to the agent and sending responses back through adapters.

## Decision 7: Token Estimation

**Decision**: Use a simple character-based approximation (1 token ≈ 4 characters for English text) for context window management. Do not depend on a tokenizer library.

**Rationale**: KISS principle. Exact tokenization varies by model (GPT uses tiktoken, Claude uses a different tokenizer, etc.). A rough estimate is sufficient for trimming conversation history — being slightly conservative is fine. This avoids pulling in heavy tokenizer dependencies.
