# Tasks: AI Agent Routing

**Input**: Design documents from `/specs/002-ai-agent-routing/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Tests**: TDD is mandated by the constitution (Principle I). All tasks include writing failing tests first, then implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the `ai-agent` package, install dependencies, wire into monorepo

- [x] T001 Create `packages/ai-agent/` package scaffold with `package.json`, `tsconfig.json`, `src/index.ts`
- [x] T002 Add `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `zod` dependencies to `packages/ai-agent/package.json`
- [x] T003 Register `packages/ai-agent` in `pnpm-workspace.yaml` and run `pnpm install`
- [x] T004 Add `@closeclaw/ai-agent` alias to `vitest.config.ts` resolve section
- [x] T005 Create AI SDK mock at `tests/__mocks__/ai-sdk.ts` for `generateText` and provider factories

**Checkpoint**: `pnpm build` and `pnpm test` pass with the new empty package wired in

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types and validation functions that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

### Types & Validation

- [x] T006 [P] Create `AiProvider` type, `AI_PROVIDERS` const, and `isAiProvider` validator in `packages/shared-types/src/ai-provider.ts` with tests in `tests/unit/shared-types/ai-provider.test.ts`
- [x] T007 [P] Create `ToolName` type, `TOOL_NAMES` const, `ToolConfig` interface, `DEFAULT_TOOL_CONFIG`, and `isValidToolConfig` validator in `packages/shared-types/src/tool-config.ts` with tests in `tests/unit/shared-types/tool-config.test.ts`
- [x] T008 [P] Create `AgentConfig` interface, `DEFAULT_SYSTEM_PROMPT`, `DEFAULT_MAX_CONTEXT_TOKENS`, `requiresApiKey`, `requiresBaseUrl`, and `isValidAgentConfig` validator in `packages/shared-types/src/agent-config.ts` with tests in `tests/unit/shared-types/agent-config.test.ts`
- [x] T009 Add optional `agent?: AgentConfig` field to `Configuration` interface in `packages/shared-types/src/configuration.ts` and update `isValidConfiguration` to validate it; extend tests in `tests/unit/shared-types/configuration.test.ts`
- [x] T010 Re-export all new types from `packages/shared-types/src/index.ts`

### Conversation Types (in ai-agent package)

- [x] T011 [P] Create `ConversationRole`, `ConversationMessage`, `Conversation`, `ConversationSummary` types and `conversationKey` helper in `packages/ai-agent/src/conversation-types.ts` with tests in `tests/unit/ai-agent/conversation-types.test.ts`
- [x] T012 [P] Create `MessageProcessor` interface, `MessageProcessorConfig` type, and constants (`CLEAR_COMMAND`, `AI_ERROR_MESSAGE`, `EMPTY_RESPONSE_MESSAGE`, etc.) in `packages/ai-agent/src/message-processor-types.ts`

### Provider Display Info

- [x] T013 Create `PROVIDER_INFO` record with display names, descriptions, and example models for all 6 providers in `packages/ai-agent/src/provider-info.ts` with tests in `tests/unit/ai-agent/provider-info.test.ts`

**Checkpoint**: All types compile, all validators tested, `pnpm test` passes. User story implementation can now begin.

---

## Phase 3: User Story 1 — Configure AI Agent Provider (Priority: P1) MVP

**Goal**: User runs `closeclaw agent configure` to select a provider, enter credentials, validate connectivity, and save to config.

**Independent Test**: Run `closeclaw agent configure`, select Ollama, enter model name, verify config saved to `~/.closeclaw/closeclaw.json` with `agent` section. Restart gateway, confirm "AI agent active" log.

**Depends on**: Phase 2 complete

### Tests for US1

- [x] T014 [P] [US1] Write tests for `createModelProvider` factory (all 6 provider paths) in `tests/unit/ai-agent/provider-factory.test.ts` — tests MUST fail before implementation
- [x] T015 [P] [US1] Write tests for `runAgentConfigure` prompt flow (provider selection, credential collection, validation, save, reconfiguration) in `tests/unit/cli/agent-configure.test.ts` — tests MUST fail before implementation

### Implementation for US1

- [x] T016 [US1] Implement `createModelProvider(config: AgentConfig): LanguageModel` in `packages/ai-agent/src/provider-factory.ts` — handle openai, anthropic, google (native adapters), ollama, kimi, custom (OpenAI-compatible with baseURL)
- [x] T017 [US1] Export `createModelProvider` from `packages/ai-agent/src/index.ts`
- [x] T018 [US1] Implement `runAgentConfigure(deps)` in `packages/cli/src/commands/agent-configure.ts` — provider select prompt, model name input, API key (masked) for cloud providers, base URL for ollama/custom, tool calling enable/disable, shell_execute warning + confirmation, validate via test `generateText` call, save to config
- [x] T019 [US1] Handle reconfiguration flow in `packages/cli/src/commands/agent-configure.ts` — detect existing agent config, display current settings, offer reconfigure/keep
- [x] T020 [US1] Handle validation failure flow in `packages/cli/src/commands/agent-configure.ts` — display error, offer re-entry or exit without saving
- [x] T021 [US1] Register `agent configure` subcommand in `packages/cli/src/cli.ts`

**Checkpoint**: `closeclaw agent configure` works end-to-end. Config saved to `closeclaw.json`. All US1 tests pass.

---

## Phase 4: User Story 2 — AI Processes Approved Messages (Priority: P2)

**Goal**: Approved DMs are forwarded to the AI model, responses sent back to sender with typing indicator. Conversation history maintained per sender. Backward compatible when no agent configured.

**Independent Test**: Configure agent (US1), start gateway, send message from approved sender, verify AI response. Send follow-up referencing first message, verify context awareness. Remove agent config, verify messages still logged (no AI processing).

**Depends on**: Phase 2 complete (can run in parallel with US1 implementation, but needs provider-factory from T016 for full integration)

### Tests for US2

- [x] T022 [P] [US2] Write tests for `createConversationStore` (getOrCreate, get, clear, list, size, pruneStale, sender isolation) in `tests/unit/ai-agent/conversation-store.test.ts` — tests MUST fail
- [x] T023 [P] [US2] Write tests for `trimHistory` (empty history, single message over limit, exact boundary, preserves system prompt, trims oldest first) in `tests/unit/ai-agent/context-trimmer.test.ts` — tests MUST fail
- [x] T024 [P] [US2] Write tests for `createMessageProcessor` basic flow (simple response, conversation history, empty response fallback, AI error handling, "/clear" command) in `tests/unit/ai-agent/message-processor.test.ts` — tests MUST fail
- [x] T025 [P] [US2] Write tests for `sendTypingIndicator` on Telegram adapter in `tests/unit/bot-adapters/telegram-adapter.test.ts` — tests MUST fail
- [x] T026 [P] [US2] Write tests for `sendTypingIndicator` on Discord adapter in `tests/unit/bot-adapters/discord-adapter.test.ts` — tests MUST fail
- [x] T027 [P] [US2] Write tests for gateway agent routing (message→processor→response, backward compat with no processor, typing indicator sent, error response delivery) in `tests/unit/gateway/gateway-server.test.ts` — tests MUST fail

### Implementation for US2

- [x] T028 [US2] Implement `createConversationStore(): ConversationStore` in `packages/ai-agent/src/conversation-store.ts` — in-memory Map keyed by `platform:senderId`, CRUD operations, pruneStale, list summaries
- [x] T029 [US2] Implement `trimHistory(messages, maxTokens): messages` in `packages/ai-agent/src/context-trimmer.ts` — character-based token estimation (1 token ≈ 4 chars), preserve system prompt + most recent messages
- [x] T030 [US2] Implement `createMessageProcessor(config): MessageProcessor` in `packages/ai-agent/src/message-processor.ts` — get/create conversation, append user message, trim context, call `generateText`, append assistant response, return text; handle "/clear", empty response, AI errors
- [x] T031 [US2] Export `createConversationStore`, `createMessageProcessor`, `trimHistory` from `packages/ai-agent/src/index.ts`
- [x] T032 [US2] Add `sendTypingIndicator(senderId: string): Promise<void>` to `BotAdapter` interface in `packages/bot-adapters/src/adapter.ts`
- [x] T033 [P] [US2] Implement `sendTypingIndicator` in `packages/bot-adapters/src/telegram-adapter.ts` via `bot.api.sendChatAction(chatId, "typing")`
- [x] T034 [P] [US2] Implement `sendTypingIndicator` in `packages/bot-adapters/src/discord-adapter.ts` via `channel.sendTyping()`
- [x] T035 [US2] Extend `GatewayServerConfig` with optional `messageProcessor` field in `packages/gateway/src/gateway-server.ts`
- [x] T036 [US2] Modify `handleAdapterMessage` in `packages/gateway/src/gateway-server.ts` — if messageProcessor: send typing indicator → processMessage → sendMessage with response; if no messageProcessor: log message (existing behavior)
- [x] T037 [US2] Implement per-sender sequential message queue in `packages/gateway/src/gateway-server.ts` to prevent race conditions on conversation history (FR-019)
- [x] T038 [US2] `GatewayServerConfig` documents processor contract (inline `messageProcessor` shape; no gateway↔ai-agent type re-export)

**Checkpoint**: Full message→AI→response loop works. Typing indicator shows. Conversation context maintained. No regressions when agent is absent. All US2 tests pass.

---

## Phase 5: User Story 3 — System Prompt and Agent Persona (Priority: P3)

**Goal**: User sets/views/edits a system prompt via CLI. System prompt included in every conversation. Default prompt used when none configured.

**Independent Test**: Run `closeclaw agent system-prompt`, enter a persona. Send messages to bot, verify responses adhere. Change prompt, verify new behavior.

**Depends on**: Phase 2 complete (independent of US1/US2 for CLI; US2 for runtime integration)

### Tests for US3

- [x] T039 [P] [US3] Write tests for `runAgentSystemPrompt` (set new prompt, view existing, edit/replace, no agent configured error) in `tests/unit/cli/agent-system-prompt.test.ts` — tests MUST fail

### Implementation for US3

- [x] T040 [US3] Implement `runAgentSystemPrompt(deps)` in `packages/cli/src/commands/agent-system-prompt.ts` — read config, show current prompt if exists, multi-line input for new/edit, save to agent.systemPrompt in config, handle no-agent-configured error
- [x] T041 [US3] Register `agent system-prompt` subcommand in `packages/cli/src/cli.ts`

**Checkpoint**: System prompt persisted in config, used by message processor (already wired in US2). All US3 tests pass.

---

## Phase 6: User Story 4 — Tool Calling and Action Execution (Priority: P4)

**Goal**: AI can call datetime, http_request, and shell_execute tools. Tool calls are executed, results returned to AI for synthesis. Safety: depth limit, timeout, config-gated.

**Independent Test**: Configure agent with tools enabled, send "What is the current date?", verify datetime tool invoked. Send HTTP request, verify result. Shell tool only works if explicitly enabled.

**Depends on**: US2 complete (message processor must work before tools can be wired in)

### Tests for US4

- [x] T042 [P] [US4] Write tests for `createDatetimeTool` (returns ISO string, timezone) in `tests/unit/ai-agent/tools/datetime-tool.test.ts` — tests MUST fail
- [x] T043 [P] [US4] Write tests for `createHttpRequestTool` (GET/POST/PUT/DELETE, status+body, error handling, timeout) in `tests/unit/ai-agent/tools/http-request-tool.test.ts` — tests MUST fail
- [x] T044 [P] [US4] Write tests for `createShellExecuteTool` (stdout/stderr/exitCode, timeout, error) in `tests/unit/ai-agent/tools/shell-execute-tool.test.ts` — tests MUST fail
- [x] T045 [P] [US4] Write tests for `createToolExecutor` (enabled tool filtering, depth limit enforcement, timeout enforcement, disabled tool blocking) in `tests/unit/ai-agent/tool-executor.test.ts` — tests MUST fail

### Implementation for US4

- [x] T046 [P] [US4] Implement `createDatetimeTool()` as AI SDK `tool()` with Zod schema in `packages/ai-agent/src/tools/datetime-tool.ts`
- [x] T047 [P] [US4] Implement `createHttpRequestTool()` as AI SDK `tool()` with Zod schema (method, url, headers, body) in `packages/ai-agent/src/tools/http-request-tool.ts`
- [x] T048 [P] [US4] Implement `createShellExecuteTool()` as AI SDK `tool()` with Zod schema (command, workingDirectory) in `packages/ai-agent/src/tools/shell-execute-tool.ts`
- [x] T049 [US4] Implement `createToolExecutor(toolConfig: ToolConfig)` in `packages/ai-agent/src/tool-executor.ts` — filter to allowed tools, wrap executions with `AbortSignal.timeout`, track/enforce call depth, return error on disallowed/exceeded
- [x] T050 [US4] Wire tools into `createMessageProcessor` in `packages/ai-agent/src/message-processor.ts` — pass enabled tools to `generateText({ tools, maxSteps })`, handle tool-disabled config (no tools passed)
- [x] T051 [US4] Export tool-related functions from `packages/ai-agent/src/index.ts`

**Checkpoint**: AI uses tools in responses. Depth limit stops infinite loops. Disabled tools are not available. All US4 tests pass.

---

## Phase 7: User Story 5 — Conversation Management (Priority: P5)

**Goal**: Sender clears history via "/clear". Owner lists conversations via CLI. Stale conversations auto-pruned.

**Independent Test**: Build conversation history, send "/clear", verify fresh start. Run `closeclaw agent conversations`, verify table output. Wait for timeout, verify pruning.

**Depends on**: US2 complete (conversation store must exist)

### Tests for US5

- [x] T052 [P] [US5] Write tests for `GET /agent/conversations` gateway endpoint (authenticated, returns conversation list) in `tests/unit/gateway/gateway-server.test.ts` — tests MUST fail
- [x] T053 [P] [US5] Write tests for `runAgentConversations` CLI command (formats table, handles empty list, handles gateway unreachable) in `tests/unit/cli/agent-conversations.test.ts` — tests MUST fail

### Implementation for US5

- [x] T054 [US5] Add `GET /agent/conversations` authenticated endpoint to `packages/gateway/src/gateway-server.ts` — returns conversation summaries from conversation store as JSON
- [x] T055 [US5] Implement `runAgentConversations(deps)` in `packages/cli/src/commands/agent-conversations.ts` — call gateway API, format table: platform | sender | messages | last activity
- [x] T056 [US5] Register `agent conversations` subcommand in `packages/cli/src/cli.ts`

**Checkpoint**: "/clear" works (already in US2 message processor). Owner can list conversations. All US5 tests pass.

---

## Phase 8: Assembly — Gateway Start Integration

**Purpose**: Wire all components together in the `gateway start` command

**Depends on**: US1 (provider factory), US2 (message processor, conversation store), US4 (tool executor)

### Tests

- [x] T057 [P] Write tests for extended `runGatewayStart` (agent config loading, provider creation, processor injection, backward compat, pruning interval) in `tests/unit/cli/gateway-start.test.ts` — tests MUST fail

### Implementation

- [x] T058 Extend `runGatewayStart` in `packages/cli/src/commands/gateway-start.ts` — read `agent` from config, if present: create provider via factory, create conversation store, create tool executor, create message processor, pass as `messageProcessor` to gateway server config, log "AI agent active: {provider}/{model}"
- [x] T059 Add stale conversation pruning interval in `packages/cli/src/commands/gateway-start.ts` — `setInterval` calling `conversationStore.pruneStale(24h)` every hour, clear on shutdown

**Checkpoint**: `closeclaw gateway start` works with and without agent config. Full end-to-end: message → gateway → AI → tools → response → sender.

---

## Phase 9: Edge Cases & Hardening

**Purpose**: Rate limiting, message length enforcement, delayed acknowledgment

**Depends on**: US2 + US4 complete

### Tests

- [x] T060 [P] Write tests for retry logic (rate limit error → exponential backoff → success, max retries exceeded) in `tests/unit/ai-agent/message-processor.test.ts` — tests MUST fail
- [x] T061 [P] Write tests for message length validation (within limit → process, over limit → reject with message) in `tests/unit/ai-agent/message-processor.test.ts` — tests MUST fail
- [x] T062 [P] Write tests for delayed "processing..." acknowledgment (response > 5s → interim message sent) in `tests/unit/gateway/gateway-server.test.ts` — tests MUST fail

### Implementation

- [x] T063 Add retry with exponential backoff to `generateText` call in `packages/ai-agent/src/message-processor.ts` — catch rate-limit errors, retry up to MAX_RETRIES with INITIAL_RETRY_DELAY_MS doubling
- [x] T064 Add input message length validation to `packages/ai-agent/src/message-processor.ts` — estimate tokens, reject if exceeds `maxContextTokens * 0.5`, return user-friendly message
- [x] T065 Add delayed "processing..." acknowledgment in `packages/gateway/src/gateway-server.ts` — if response takes > PROCESSING_ACK_DELAY_MS (5s), send interim message to sender via adapter

**Checkpoint**: Rate limits handled gracefully. Oversized messages rejected clearly. Long-running requests acknowledged. All edge case tests pass.

---

## Phase 10: Integration Test

**Purpose**: End-to-end agent loop validation with mocked AI SDK

- [x] T066 Write integration test for full agent loop (message → conversation → context trim → generateText → tool call → tool result → final response) in `tests/integration/ai-agent/agent-loop.test.ts`

**Checkpoint**: Integration test passes, validating the full chain with mocked provider.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Coverage, linting, formatting, final validation

- [x] T067 [P] Run `pnpm test:coverage` and fix any files below 90% threshold
- [x] T068 [P] Run `pnpm lint` and fix all warnings
- [x] T069 [P] Run `pnpm format:check` and fix all formatting issues
- [x] T070 Run quickstart.md validation steps (Steps 1–10) to verify end-to-end behavior

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2
- **Phase 4 (US2)**: Depends on Phase 2 (provider-factory from US1 needed for full integration but tests can start in parallel)
- **Phase 5 (US3)**: Depends on Phase 2 (CLI-only; runtime integration via US2)
- **Phase 6 (US4)**: Depends on US2 (message processor must exist)
- **Phase 7 (US5)**: Depends on US2 (conversation store must exist)
- **Phase 8 (Assembly)**: Depends on US1 + US2 + US4
- **Phase 9 (Edge Cases)**: Depends on US2 + US4
- **Phase 10 (Integration)**: Depends on Phase 8
- **Phase 11 (Polish)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: Independent after Phase 2 — **MVP target**
- **US2 (P2)**: Needs provider-factory from US1; can start tests in parallel
- **US3 (P3)**: Independent (CLI) but runtime depends on US2 message processor
- **US4 (P4)**: Depends on US2 message processor
- **US5 (P5)**: Depends on US2 conversation store

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Constitution Principle I)
- Types/models before services
- Services before CLI/gateway integration
- Core implementation before edge cases
- Commit after each task (Constitution Principle IV)

### Parallel Opportunities

**Phase 2** (all T006–T013 marked [P] can run in parallel — different files):

```
T006 (ai-provider) || T007 (tool-config) || T008 (agent-config) || T011 (conversation-types) || T012 (message-processor-types) || T013 (provider-info)
```

**US1 tests** (T014 || T015 — different test files)

**US2 tests** (T022 || T023 || T024 || T025 || T026 || T027 — all different files)

**US2 adapter implementation** (T033 || T034 — telegram and discord in different files)

**US4 tests** (T042 || T043 || T044 || T045 — all different files)

**US4 tool implementation** (T046 || T047 || T048 — all different files)

**US3 + US1 implementation**: US3 CLI can be built while US1 implementation is in progress (different files)

---

## Parallel Example: User Story 2

```text
# Wave 1 — Tests (all parallel, different files):
T022: conversation-store.test.ts
T023: context-trimmer.test.ts
T024: message-processor.test.ts
T025: telegram-adapter.test.ts (typing indicator)
T026: discord-adapter.test.ts (typing indicator)
T027: gateway-server.test.ts (agent routing)

# Wave 2 — Core implementations (sequential within, parallel across):
T028: conversation-store.ts
T029: context-trimmer.ts
T032: adapter.ts (interface change)

# Wave 3 — Dependent implementations:
T030: message-processor.ts (depends on T028, T029)
T033 || T034: telegram + discord typing (depend on T032)
T035 → T036 → T037: gateway integration (sequential)
```

---

## Parallel Example: User Story 4

```text
# Wave 1 — Tests (all parallel):
T042: datetime-tool.test.ts
T043: http-request-tool.test.ts
T044: shell-execute-tool.test.ts
T045: tool-executor.test.ts

# Wave 2 — Tool implementations (all parallel):
T046: datetime-tool.ts
T047: http-request-tool.ts
T048: shell-execute-tool.ts

# Wave 3 — Sequential:
T049: tool-executor.ts (depends on T046–T048)
T050: message-processor.ts (wire tools, depends on T049)
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational types + validators
3. Complete Phase 3: US1 — `agent configure` CLI
4. **STOP and VALIDATE**: Run `closeclaw agent configure`, verify config saved
5. Demo: Agent configured, gateway logs "AI agent active"

### Incremental Delivery

1. Setup + Foundational → Types ready
2. US1 → Agent configurable → **MVP!**
3. US2 → Bot responds with AI → **Core value delivery**
4. US3 → Custom personas → Enhanced UX
5. US4 → Tool calling → **Automation engine**
6. US5 → Conversation management → Operational control
7. Assembly + Edge Cases + Polish → Production-ready

### Suggested Execution Order (solo developer)

Phase 1 → Phase 2 → US1 → US2 → US3 → US4 → US5 → Assembly → Edge Cases → Integration → Polish

---

## Notes

- [P] tasks = different files, no dependencies
- [US*] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Tests MUST fail before implementing (TDD — Constitution Principle I)
- Commit after each task (Atomic Commits — Constitution Principle IV)
- `pnpm test` MUST pass at every commit
- Total tasks: 70
