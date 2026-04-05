# AI Agent

The AI agent processes incoming bot messages through a configured
language model, optionally using tools to take actions before
responding.

## Architecture

```text
User Message → Bot Adapter → Gateway → Message Processor → AI SDK
                                                            ↓
                                                      Tool Calls
                                                      (optional)
                                                            ↓
                                                      Response
                                                            ↓
                                          Bot Adapter ← Gateway
```

## Conversation Management

Each sender gets an isolated conversation keyed by
`platform:senderId`. Conversations persist in memory for the
lifetime of the gateway process.

**Context Trimming:** When a conversation exceeds the token estimate
limit, older messages are trimmed from the history while preserving
the system prompt and the most recent messages.

**Stale Pruning:** Conversations inactive for 24 hours are
automatically pruned.

**Clearing:** Send `/clear` to the bot to reset your conversation
history.

## Supported Providers

### OpenAI

Uses the official `@ai-sdk/openai` adapter. Requires an
`OPENAI_API_KEY` or manual key entry during configuration.

### Anthropic Claude

Uses the official `@ai-sdk/anthropic` adapter. Requires an
`ANTHROPIC_API_KEY` or manual key entry.

### Google Gemini

Uses the official `@ai-sdk/google` adapter. Requires a
`GOOGLE_GENERATIVE_AI_API_KEY` or manual key entry.

### Ollama (Local)

Connects to a local Ollama instance via OpenAI-compatible API.
Default base URL: `http://localhost:11434`. No API key required.

### Kimi (Moonshot AI)

Connects via OpenAI-compatible adapter pointed at
`https://api.moonshot.ai/v1`. Requires an API key.

### Custom

Any provider exposing an OpenAI-compatible endpoint. Provide a
base URL and optional API key.

## Built-in Tools

Tools extend the AI's capabilities beyond text generation.

### datetime

Returns the current date, time, and timezone. Always enabled when
tool calling is active. No security implications.

### http_request

Makes HTTP requests to external APIs. The AI can fetch data from
URLs, call REST endpoints, and retrieve web content. Enable when
the AI needs to access external services.

### shell_execute

Runs shell commands on the host machine. Requires explicit opt-in
during configuration with a security warning. The AI can execute
arbitrary commands, so use with caution.

**Security:** When enabling `shell_execute`, the configuration
wizard shows a risk acknowledgment prompt. Only enable on
trusted machines.

## Retry and Error Handling

- Rate limit errors (HTTP 429) trigger automatic retry with
  exponential backoff (up to 3 attempts)
- Oversized messages are rejected with a user-friendly error
- Network failures are logged and a fallback error message is
  sent to the user
- The gateway process remains stable through transient errors

## Response Delivery

While the AI processes a message:

1. A typing indicator is sent immediately and refreshed every
   4 seconds for continuous feedback
2. After 5 seconds, a "Processing your message..." notification
   is sent
3. The final AI response is delivered as a batch message

If the AI makes tool calls but produces no final text, the system
extracts the last textual output from intermediate steps.
