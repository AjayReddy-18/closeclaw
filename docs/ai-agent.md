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
`platform:senderId`. Conversations are stored on disk and
survive gateway restarts.

**Persistent Storage:** Conversations are saved as JSON files
in `~/.closeclaw/conversations/<platform>-<senderId>.json`.
Files are written atomically (write to `.tmp`, then rename) to
prevent corruption. Conversations are loaded lazily on first
message from each sender, ensuring fast gateway startup
regardless of how many files exist.

**Context Trimming:** When a conversation exceeds the token estimate
limit, older messages are trimmed from the history while preserving
the system prompt and the most recent messages.

**Automatic Compression:** When a conversation exceeds 50 messages
(configurable via `compressionThreshold`), older messages are
automatically summarized by the AI model into a rolling summary.
The 20 most recent messages (configurable via `keepRecentCount`)
are kept verbatim. The summary is stored in the conversation file
and prepended to the AI context so historical facts remain
accessible. Compression runs non-blocking after the response is
delivered to the user.

**Memory Flush:** Before compression, the system extracts durable
facts and preferences from the about-to-be-compressed messages
and saves them to the preference file. This prevents accidental
loss of important context during compression.

**Stale Pruning:** Conversations inactive for 24 hours are
automatically pruned (both in memory and on disk).

**Clearing:** Send `/clear` to the bot to reset your conversation
history. The conversation file is deleted but preferences are
preserved.

## Sender Identity

The AI model automatically receives the sender's display name,
platform, and ID in the system prompt. This means the bot knows
who it is talking to from the very first message — it can address
users by name and personalize responses without needing to be
told. The display name is extracted from the platform metadata
(Telegram first/last name, Discord display name) and falls back
to the sender ID when no name is available.

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

## User Preference Memory

The agent automatically identifies and stores user preferences
during conversation. When you share personal information like
your name, timezone, language preferences, or likes/dislikes,
the AI stores them in a dedicated preference file at
`~/.closeclaw/preferences/<platform>-<senderId>.json`.

Preferences are:

- **Automatically extracted** on every message (no trigger word
  needed)
- **Injected into the AI context** for personalized responses
- **Independent of conversation history** — `/clear` does not
  erase preferences
- **Persistent across restarts** — loaded from disk
- **Forgettable** — tell the bot "forget my timezone" to remove
  a specific preference

## Built-in Tools

Tools extend the AI's capabilities beyond text generation.

### save_preference

Automatically called by the AI when it identifies preference-worthy
information. Stores a key-value pair in the sender's preference file.
Always available when tool calling is active.

### forget_preference

Called when the user asks to forget a specific preference. Removes
the entry from the preference file.

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

## Enhanced System Prompt

The AI agent uses a multi-section built-in system prompt that
guides response quality:

- **Identity:** Defines CloseClaw's role and personality
- **Response Style:** Enforces conciseness, no filler phrases,
  structured formatting for complex answers
- **Platform Awareness:** Adjusts for mobile-friendly chat
- **Tool Usage:** Instructs proactive tool use over speculation
- **Scheduling Behavior:** Defines the structured prefix protocol
  (TASK_COMPLETE, TASK_IN_PROGRESS, TASK_FAILED)
- **Preferences:** Guides the agent to respect and save user
  verbosity preferences

User-configured `systemPrompt` is prepended as "Owner Instructions"
and takes priority over the built-in sections.

## Response Formatting

AI responses are automatically formatted for each platform:

- **Telegram:** Markdown is converted to Telegram-compatible HTML.
  Headers become bold text, code blocks use `<pre>/<code>` tags,
  tables are converted to readable plain text. Messages exceeding
  Telegram's 4096-character limit are split at natural boundaries.
  Falls back to plain text if the API rejects the HTML.
- **Discord:** Markdown is passed through as-is since Discord
  natively renders it.

See `docs/response-formatting.md` for details.

## Response Delivery

While the AI processes a message:

1. A typing indicator is sent immediately and refreshed every
   4 seconds for continuous feedback
2. After 5 seconds, a "Processing your message..." notification
   is sent
3. The final AI response is delivered as formatted message(s)

If the AI makes tool calls but produces no final text, the system
extracts the last textual output from intermediate steps.
