# Implementation Plan: AI Agent Routing

**Branch**: `002-ai-agent-routing` | **Date**: 2026-04-05 | **Spec**: `specs/002-ai-agent-routing/spec.md`
**Input**: Feature specification from `/specs/002-ai-agent-routing/spec.md`

## Summary

Transform CloseClaw from a message gatekeeper into an intelligent AI assistant. Approved DMs are forwarded to a configurable AI model (OpenAI, Anthropic, Gemini, Ollama, Kimi, or custom OpenAI-compatible) via the Vercel AI SDK. The model responds with text or tool calls (shell, HTTP, datetime). Responses are sent back to the sender with a typing indicator. Per-sender conversation history is maintained in memory with automatic stale-conversation pruning.

## Technical Context

**Language/Version**: TypeScript 5.8 (strict mode, no `any`)
**Primary Dependencies**: Vercel AI SDK (`ai`), `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `zod`
**Storage**: In-memory `Map` for conversations; `~/.closeclaw/closeclaw.json` for agent config
**Testing**: Vitest (unit, integration, contract); coverage threshold 90%
**Target Platform**: Node.js 22 LTS, macOS/Linux
**Project Type**: CLI + long-running gateway service (monorepo)
**Performance Goals**: Response routing < 100ms (excluding model inference); message queue processing < 10ms
**Constraints**: Max 10 tool calls per turn; 30s tool timeout; sequential message processing per sender
**Scale/Scope**: Single operator, multiple senders, 6 AI providers

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                | Status | Notes                                                                                                       |
| ------------------------ | ------ | ----------------------------------------------------------------------------------------------------------- |
| I. TDD                   | PASS   | All new code follows Red-Green-Refactor. AI SDK calls are mocked in tests.                                  |
| II. Clean Code           | PASS   | No comments. Functions < 20 lines. Files < 200 lines. New package split by responsibility.                  |
| III. Design Principles   | PASS   | Adapter pattern for providers (via AI SDK). DI for all external dependencies. Composition over inheritance. |
| IV. Atomic Commits       | PASS   | Each user story broken into small, independently testable commits.                                          |
| V. Automation-First      | PASS   | Core feature enables AI-driven automation. Tool calling ships shell, HTTP, datetime.                        |
| VI. Modular Architecture | PASS   | New `ai-agent` package. Explicit interface contracts with `gateway`. No circular deps.                      |

## Project Structure

### Documentation (this feature)

```text
specs/002-ai-agent-routing/
├── plan.md              # This file
├── research.md          # Phase 0 output (decision log)
├── data-model.md        # Phase 1 output (type definitions)
├── quickstart.md        # Phase 1 output (setup + validation)
├── contracts/           # Phase 1 output (interface contracts)
│   ├── agent-config.ts
│   ├── ai-provider.ts
│   ├── conversation.ts
│   ├── tool-definition.ts
│   └── message-processor.ts
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── shared-types/src/
│   ├── (existing files)
│   ├── agent-config.ts           # AgentConfig type + validation
│   ├── ai-provider.ts            # AiProvider enum + helpers
│   └── tool-config.ts            # ToolConfig type
│
├── ai-agent/                     # NEW PACKAGE
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── provider-factory.ts   # Creates AI SDK model instances
│       ├── conversation-store.ts # In-memory per-sender conversation store
│       ├── context-trimmer.ts    # Token-estimate-based history trimming
│       ├── message-processor.ts  # Agent loop: receive → AI → tools → respond
│       ├── tool-executor.ts      # Tool call dispatch + timeout + depth limit
│       └── tools/
│           ├── datetime-tool.ts
│           ├── http-request-tool.ts
│           └── shell-execute-tool.ts
│
├── gateway/src/
│   ├── (existing files)
│   └── gateway-server.ts         # MODIFIED: route approved msgs to ai-agent
│
├── cli/src/
│   ├── (existing files)
│   └── commands/
│       ├── agent-configure.ts    # NEW: closeclaw agent configure
│       ├── agent-system-prompt.ts # NEW: closeclaw agent system-prompt
│       └── agent-conversations.ts # NEW: closeclaw agent conversations
│
└── bot-adapters/src/
    └── adapter.ts                # MODIFIED: add sendTypingIndicator()

tests/
├── unit/
│   ├── ai-agent/
│   │   ├── provider-factory.test.ts
│   │   ├── conversation-store.test.ts
│   │   ├── context-trimmer.test.ts
│   │   ├── message-processor.test.ts
│   │   ├── tool-executor.test.ts
│   │   └── tools/
│   │       ├── datetime-tool.test.ts
│   │       ├── http-request-tool.test.ts
│   │       └── shell-execute-tool.test.ts
│   ├── cli/
│   │   ├── agent-configure.test.ts
│   │   ├── agent-system-prompt.test.ts
│   │   └── agent-conversations.test.ts
│   └── gateway/
│       └── gateway-server.test.ts  # EXTENDED: agent routing tests
├── integration/
│   └── ai-agent/
│       └── agent-loop.test.ts      # End-to-end: message → AI → tool → response
└── __mocks__/
    └── ai-sdk.ts                   # Mock for Vercel AI SDK generateText
```

**Structure Decision**: New `packages/ai-agent` package follows Constitution VI (modular architecture). It depends on `@closeclaw/shared-types` for config types and exports a `MessageProcessor` interface consumed by `@closeclaw/gateway`. No direct dependency on bot-adapters — the gateway orchestrates the hand-off.

## Implementation Phases

### Phase 1: Foundation — Shared Types + AI Agent Package Scaffold (US1 prerequisite)

**Goal**: Define all new types in `shared-types`, create the `ai-agent` package skeleton, and wire it into the monorepo.

**Files created/modified**:

- `packages/shared-types/src/ai-provider.ts` — `AiProvider` enum (openai, anthropic, google, ollama, kimi, custom)
- `packages/shared-types/src/agent-config.ts` — `AgentConfig` interface + validation
- `packages/shared-types/src/tool-config.ts` — `ToolConfig` type (enabled tools, depth limit, timeout)
- `packages/shared-types/src/index.ts` — re-export new types
- `packages/shared-types/src/configuration.ts` — add optional `agent?: AgentConfig` field
- `packages/ai-agent/package.json` — new package with deps on `ai`, `@ai-sdk/*`, `zod`
- `packages/ai-agent/tsconfig.json`
- `packages/ai-agent/src/index.ts` — barrel exports
- `pnpm-workspace.yaml` — add `packages/ai-agent`
- `vitest.config.ts` — add alias for `@closeclaw/ai-agent`

**Tests**: Unit tests for all validation functions. Contract tests for `AgentConfig` shape.

**Commit pattern**: 1) types + validation, 2) package scaffold + workspace wiring

---

### Phase 2: Provider Factory (US1)

**Goal**: Build the factory that takes an `AgentConfig` and returns a Vercel AI SDK `LanguageModel` instance for any supported provider.

**Files created/modified**:

- `packages/ai-agent/src/provider-factory.ts` — `createModelProvider(config: AgentConfig): LanguageModel`
  - OpenAI → `createOpenAI({ apiKey })('gpt-4o')`
  - Anthropic → `createAnthropic({ apiKey })('claude-sonnet-4-20250514')`
  - Google → `createGoogleGenerativeAI({ apiKey })('gemini-2.0-flash')`
  - Ollama → `createOpenAI({ baseURL: config.baseUrl, apiKey: 'ollama' })(config.model)`
  - Kimi → `createOpenAI({ baseURL: 'https://api.moonshot.ai/v1', apiKey })(config.model)`
  - Custom → `createOpenAI({ baseURL: config.baseUrl, apiKey })(config.model)`

**Tests**: Unit test per provider path (mock `createOpenAI`, `createAnthropic`, `createGoogleGenerativeAI`). Verify correct arguments passed.

**Commit pattern**: 1) factory + tests

---

### Phase 3: Conversation Store + Context Trimmer (US2, US5 foundation)

**Goal**: In-memory conversation store with per-sender history, token-estimate trimming, and stale-conversation pruning.

**Files created/modified**:

- `packages/ai-agent/src/conversation-store.ts` — `ConversationStore` class
  - `getOrCreate(platform, senderId): Conversation`
  - `clear(platform, senderId): void`
  - `list(): ConversationSummary[]`
  - `pruneStale(maxAgeMs): number`
- `packages/ai-agent/src/context-trimmer.ts` — `trimHistory(messages, maxTokens): messages`
  - Character-based token estimation (1 token ≈ 4 chars)
  - Preserves system prompt + most recent messages

**Tests**: Store CRUD, concurrent sender isolation, pruning logic, trimmer edge cases (empty history, single message exceeds limit, exact boundary).

**Commit pattern**: 1) conversation store + tests, 2) context trimmer + tests

---

### Phase 4: Built-in Tools (US4)

**Goal**: Implement the three built-in tools as AI SDK `tool()` definitions with Zod schemas.

**Files created/modified**:

- `packages/ai-agent/src/tools/datetime-tool.ts` — returns current ISO timestamp + timezone
- `packages/ai-agent/src/tools/http-request-tool.ts` — makes HTTP request (GET/POST/PUT/DELETE), returns status + body
- `packages/ai-agent/src/tools/shell-execute-tool.ts` — executes shell command, returns stdout/stderr/exitCode
- `packages/ai-agent/src/tool-executor.ts` — aggregates enabled tools, enforces depth limit and timeout

**Safety controls in tool-executor**:

- Wraps each tool's `execute` with a timeout (`AbortSignal.timeout`)
- Tracks call depth per turn; returns error string when exceeded
- Only includes tools that are enabled in `ToolConfig`

**Tests**: Each tool tested in isolation. Executor tested for depth-limit enforcement, timeout behavior, disabled-tool filtering.

**Commit pattern**: 1) datetime tool + tests, 2) http tool + tests, 3) shell tool + tests, 4) executor + tests

---

### Phase 5: Message Processor — Agent Loop (US2, US4)

**Goal**: The core agent loop: receive message → build context → call `generateText` with tools → handle tool results → return final text.

**Files created/modified**:

- `packages/ai-agent/src/message-processor.ts` — `MessageProcessor` interface + `createMessageProcessor()`
  - `processMessage(platform, senderId, text, senderDisplayName?): Promise<string>`
  - Internally: get/create conversation → trim context → call `generateText({ model, messages, tools, maxSteps })` → append assistant response to history → return text
  - Handles AI errors gracefully (returns user-friendly error string)
  - Handles "/clear" command by clearing conversation and returning confirmation
  - Handles empty AI response with fallback message

**Tests**: Full agent loop with mocked `generateText`. Test cases: simple response, multi-step tool calling, error handling, "/clear" command, empty response, max steps reached, rate limit retry.

**Commit pattern**: 1) basic message→response loop + tests, 2) tool calling integration + tests, 3) error handling + "/clear" + tests

---

### Phase 6: Bot Adapter Enhancement — Typing Indicator (US2)

**Goal**: Add `sendTypingIndicator()` to the `BotAdapter` interface and implement for Telegram and Discord.

**Files created/modified**:

- `packages/bot-adapters/src/adapter.ts` — add `sendTypingIndicator(senderId: string): Promise<void>`
- `packages/bot-adapters/src/telegram-adapter.ts` — implement via `bot.api.sendChatAction(chatId, "typing")`
- `packages/bot-adapters/src/discord-adapter.ts` — implement via `channel.sendTyping()`

**Tests**: Unit tests for typing indicator calls on both adapters.

**Commit pattern**: 1) interface + telegram impl + tests, 2) discord impl + tests

---

### Phase 7: Gateway Integration (US2, US4, US6/backward compat)

**Goal**: Modify the gateway to route approved messages through the AI agent instead of just logging them. Maintain full backward compatibility when no agent is configured.

**Files created/modified**:

- `packages/gateway/src/gateway-server.ts` — modify `handleAdapterMessage`:
  - If no message processor configured → log message (existing behavior, FR-011)
  - If message processor configured → send typing indicator → call `processMessage` → send response via `adapter.sendMessage`
  - Sequential per-sender processing via a per-sender queue/lock
- `packages/gateway/src/gateway-server.ts` — extend `GatewayServerConfig` to accept an optional `MessageProcessor`
- `packages/gateway/src/index.ts` — re-export `MessageProcessor` type

**Tests**: Gateway tests extended for: agent routing, backward compatibility (no agent), error response delivery, sequential sender processing, typing indicator sent before processing.

**Commit pattern**: 1) config extension + backward compat test, 2) agent routing + typing + tests, 3) per-sender sequential queue + tests

---

### Phase 8: CLI — `closeclaw agent configure` (US1)

**Goal**: Interactive CLI command to configure the AI provider, model, API key, and tool settings.

**Files created/modified**:

- `packages/cli/src/commands/agent-configure.ts` — `runAgentConfigure(deps)`
  - Prompt: select provider → enter model name → enter API key (masked, skip for Ollama) → enter base URL (for Ollama/custom) → enable tool calling? → enable shell tool? (with warning) → validate with test request → save to config
  - Reconfiguration: detect existing agent config, show current, offer change/keep
- `packages/cli/src/cli.ts` — register `agent configure` subcommand

**Tests**: Full prompt flow mocked. Validation success/failure paths. Reconfiguration flow. Shell tool warning acknowledgment.

**Commit pattern**: 1) prompt flow + tests, 2) validation + save + tests, 3) reconfiguration + tests, 4) CLI registration

---

### Phase 9: CLI — `closeclaw agent system-prompt` (US3)

**Goal**: CLI command to set/view/edit the system prompt.

**Files created/modified**:

- `packages/cli/src/commands/agent-system-prompt.ts` — `runAgentSystemPrompt(deps)`
  - If no system prompt: prompt for input
  - If existing: display current, offer edit/keep
  - Multi-line input via editor prompt or multi-line text input

**Tests**: Set new prompt, view existing, edit existing, default prompt behavior.

**Commit pattern**: 1) set + view + tests, 2) edit flow + tests, 3) CLI registration

---

### Phase 10: CLI — `closeclaw agent conversations` (US5)

**Goal**: CLI command to list active conversations. Gateway API endpoint to expose conversation data.

**Files created/modified**:

- `packages/gateway/src/gateway-server.ts` — add `GET /agent/conversations` endpoint (authenticated)
- `packages/cli/src/commands/agent-conversations.ts` — `runAgentConversations(deps)`
  - Calls gateway API, formats table: platform | sender | messages | last activity

**Tests**: API endpoint tests. CLI formatting tests.

**Commit pattern**: 1) gateway endpoint + tests, 2) CLI command + tests, 3) CLI registration

---

### Phase 11: Gateway Start Integration (US1→US5 assembly)

**Goal**: Wire everything together in `gateway start`: load agent config, create provider, create message processor, inject into gateway server.

**Files created/modified**:

- `packages/cli/src/commands/gateway-start.ts` — extend to:
  - Read agent config from `closeclaw.json`
  - If agent configured: create provider via factory, create message processor, pass to gateway server config
  - Start stale conversation pruning interval
  - Log "AI agent active: {provider}/{model}" on startup

**Tests**: Gateway start with agent configured, without agent (backward compat), pruning interval setup/teardown.

**Commit pattern**: 1) agent loading + provider creation + tests, 2) pruning interval + tests

---

### Phase 12: Rate Limiting + Message Length Enforcement (Edge cases)

**Goal**: Handle rate limit retries with exponential backoff and message length validation.

**Files created/modified**:

- `packages/ai-agent/src/message-processor.ts` — wrap `generateText` call with retry logic (exponential backoff, max 3 retries)
- `packages/ai-agent/src/message-processor.ts` — validate input message length before processing; reject with user-friendly message if too long
- `packages/gateway/src/gateway-server.ts` — send "processing..." message if response takes > 5 seconds

**Tests**: Retry behavior on rate limit errors. Message rejection for oversized input. Delayed processing acknowledgment.

**Commit pattern**: 1) retry logic + tests, 2) length validation + tests, 3) delayed ack + tests

---

### Phase 13: Coverage + Lint + Format Pass

**Goal**: Ensure all thresholds met, no lint warnings, consistent formatting.

**Actions**:

- Run `pnpm test:coverage` — verify 90%+ across all metrics
- Run `pnpm lint` — zero warnings
- Run `pnpm format:check` — zero issues
- Fix any gaps

**Commit pattern**: Fix commits as needed

## Complexity Tracking

| Violation                | Why Needed                                                                                        | Simpler Alternative Rejected Because                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 5th package (`ai-agent`) | AI logic is orthogonal to gateway/bot-adapters; mixing would violate SRP and create circular deps | Putting AI code in gateway would couple message processing to HTTP server lifecycle |
| `zod` dependency         | AI SDK tool schemas require Zod; it's a peer dependency of `ai`                                   | JSON Schema alone lacks runtime validation that Zod provides for tool inputs        |
