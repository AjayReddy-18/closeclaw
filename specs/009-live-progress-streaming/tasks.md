# Tasks: Live Progress Streaming

**Input**: Design documents from `/specs/009-live-progress-streaming/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/live-message-api.md

**Tests**: Included — constitution mandates TDD with 90%+ coverage.

**Organization**: Tasks grouped by user story. US1 (Cursor delegation progress) depends on foundational adapter work. US2 (AI thinking) and US3 (scheduled tasks) can proceed after foundational phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Extend adapter interface with edit capability and the `SendResult` type.

- [ ] T001 Add `SendResult` interface and `editMessage` optional method to `BotAdapter` in `packages/bot-adapters/src/adapter.ts`
- [ ] T002 Export new `SendResult` and `LiveMessage` types from `packages/bot-adapters/src/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement `editMessage` on both adapters and build the core `LiveMessage` abstraction. ALL user stories depend on this.

**CRITICAL**: No user story work can begin until this phase is complete.

### Tests

- [ ] T003 [P] Write unit tests for `TelegramAdapter.editMessage` and `sendMessage` returning `SendResult` in `packages/bot-adapters/__tests__/telegram-edit.test.ts`
- [ ] T004 [P] Write unit tests for `DiscordAdapter.editMessage` and `sendMessage` returning `SendResult` in `packages/bot-adapters/__tests__/discord-edit.test.ts`
- [ ] T005 [P] Write unit tests for `createLiveMessage` covering throttling, fallback, finalize, dispose, and "message not modified" handling in `packages/bot-adapters/__tests__/live-message.test.ts`

### Implementation

- [ ] T006 [P] Implement `editMessage` and return `SendResult` from `sendMessage` in `packages/bot-adapters/src/telegram-adapter.ts` (use `bot.api.editMessageText`, catch "message not modified" as success)
- [ ] T007 [P] Implement `editMessage` and return `SendResult` from `sendMessage` in `packages/bot-adapters/src/discord-adapter.ts` (use `Message.edit()`, store sent `Message` reference)
- [ ] T008 Implement `createLiveMessage` factory in `packages/bot-adapters/src/live-message.ts` with `update()`, `finalize()`, `dispose()` per contract (throttled edits, fallback to new messages, split handling via `splitMessage`)

**Checkpoint**: Adapters support editing, `LiveMessage` abstraction is complete and fully tested. User story work can begin.

---

## Phase 3: User Story 1 — Live Cursor Delegation Progress (Priority: P1)

**Goal**: Cursor delegation tasks show rolling progress in a single live-updating message instead of 5-10+ separate messages.

**Independent Test**: Ask the bot to delegate a coding task to Cursor and verify progress appears as edits to one message, replaced by the final summary.

### Tests

- [ ] T009 [US1] Write integration tests for `runAgentResponse` with `LiveMessage` — verify `update` is called for progress, `finalize` is called with final response, no orphaned progress messages — in `packages/gateway/__tests__/gateway-agent-handler-live.test.ts`

### Implementation

- [ ] T010 [US1] Modify `runAgentResponse` in `packages/gateway/src/gateway-agent-handler.ts` to create a `LiveMessage` at start ("Thinking..."), wire `progressRef.send` to `liveMessage.update()`, wire `onIntermediate` to `liveMessage.update()`, call `liveMessage.finalize(response)` on success, `liveMessage.finalize(errorMessage)` on failure
- [ ] T011 [US1] Ensure approval prompts (Cursor accept/deny buttons) bypass `LiveMessage` — sent via `sendMessageWithButtons` as separate new messages in `packages/gateway/src/gateway-agent-handler.ts`
- [ ] T012 [US1] Remove the separate "Processing your message..." send from `runAgentResponse` in `packages/gateway/src/gateway-agent-handler.ts` (the "Thinking..." live message replaces it)

**Checkpoint**: Cursor delegation progress and all interactive AI responses appear as a single live-updating message. Approval buttons still work as separate messages.

---

## Phase 4: User Story 2 — Live AI Thinking Indicator (Priority: P2)

**Goal**: Every AI response shows "Thinking..." → tool usage → final answer in a single message, no leftover indicators.

**Independent Test**: Send any message to the bot and verify a single live-updating message appears during processing and is replaced with the final response.

### Tests

- [ ] T013 [US2] Add test cases to `packages/gateway/__tests__/gateway-agent-handler-live.test.ts` verifying: "Thinking..." sent first, tool call names update the message, final response replaces it, no orphaned messages

### Implementation

- [ ] T014 [US2] Wire continuation-round intermediate responses (`onIntermediate` in `invokeModel`) through `liveMessage.update()` in `packages/gateway/src/gateway-agent-handler.ts` — verify intermediate "let me check..." text updates the live message instead of sending a new one
- [ ] T015 [US2] Handle edge case where AI response is empty — finalize with `EMPTY_RESPONSE_MESSAGE` or `AI_ERROR_MESSAGE` instead of leaving "Thinking..." orphaned in `packages/gateway/src/gateway-agent-handler.ts`

**Checkpoint**: All interactive AI responses (with and without tool calls) use the live-updating message pattern. No orphaned "Thinking..." messages.

---

## Phase 5: User Story 3 — Live Scheduled Task Feedback (Priority: P3)

**Goal**: Scheduled task delivery uses the same live-updating pattern for consistent UX.

**Independent Test**: Create a one-shot scheduled task and verify the delivery uses an updating message.

### Tests

- [ ] T016 [US3] Write unit tests for live-message delivery in scheduler — verify `createLiveMessage` is used, "Running scheduled task..." appears, finalize called with result — in `packages/cli/__tests__/scheduler-setup-live.test.ts`

### Implementation

- [ ] T017 [US3] Modify `buildDeliveryFn` in `packages/cli/src/commands/scheduler-setup.ts` to accept adapter's `editMessage` capability, create a `LiveMessage`, send "Running scheduled task..." initially, and finalize with the result text
- [ ] T018 [US3] Pass adapter `editMessage` binding to `buildDeliveryFn` in `packages/cli/src/commands/gateway-start.ts` (wire the new parameter from the active adapter)

**Checkpoint**: Scheduled task results are delivered using the live-updating message pattern, consistent with interactive responses.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, documentation, final quality verification.

- [ ] T019 [P] Handle "message not modified" error gracefully in `TelegramAdapter.editMessage` — catch Telegram 400 error and return `true` in `packages/bot-adapters/src/telegram-adapter.ts`
- [ ] T020 [P] Handle race condition where `finalize` is called before initial `update` send completes in `packages/bot-adapters/src/live-message.ts`
- [ ] T021 [P] Create user-facing documentation at `docs/live-progress.md` covering: what live progress is, how it works, platform support, fallback behavior
- [ ] T022 [P] Update `README.md` with live progress streaming feature entry
- [ ] T023 Run full test suite (`pnpm test`), verify 90%+ coverage, run `pnpm lint` and `pnpm format:check`
- [ ] T024 Build all packages (`pnpm build`) and verify no stale dist artifacts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — provides the gateway integration
- **US2 (Phase 4)**: Depends on Phase 3 — builds on the same `runAgentResponse` changes (extends, not replaces)
- **US3 (Phase 5)**: Depends on Phase 2 — independent of US1/US2 (different package: `cli`)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Requires foundational `LiveMessage` + adapter edits. Gateway-only changes.
- **US2 (P2)**: Extends US1's `runAgentResponse` changes with intermediate response handling. Same file, sequential after US1.
- **US3 (P3)**: Independent of US1/US2. Only requires foundational phase. Can parallel with US1 if desired.

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Adapter changes before LiveMessage
- LiveMessage before gateway/cli wiring
- Core implementation before edge cases

### Parallel Opportunities

- T003, T004, T005 — all foundational tests (different files)
- T006, T007 — adapter implementations (different files)
- T019, T020, T021, T022 — all polish tasks (different files)
- US3 (Phase 5) can run in parallel with US1 (Phase 3) since they touch different packages

---

## Parallel Example: Foundational Phase

```bash
# Launch all tests in parallel (different files):
Task: T003 "TelegramAdapter edit tests"
Task: T004 "DiscordAdapter edit tests"
Task: T005 "LiveMessage unit tests"

# Launch adapter implementations in parallel (different files):
Task: T006 "Telegram editMessage implementation"
Task: T007 "Discord editMessage implementation"
```

## Parallel Example: Polish Phase

```bash
# All polish tasks can run in parallel:
Task: T019 "Telegram 'message not modified' handling"
Task: T020 "Finalize race condition fix"
Task: T021 "docs/live-progress.md"
Task: T022 "README.md update"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T008)
3. Complete Phase 3: US1 — Live Cursor Delegation (T009–T012)
4. **STOP and VALIDATE**: Test Cursor delegation produces single live-updating message
5. Commit and verify

### Incremental Delivery

1. Setup + Foundational → Adapter edits + LiveMessage ready
2. Add US1 → Test Cursor live progress → Commit (MVP!)
3. Add US2 → Test AI thinking indicator → Commit
4. Add US3 → Test scheduled task delivery → Commit
5. Polish → Docs, edge cases, final quality gate → Commit

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Each user story is independently testable after foundational phase
- Commit after each phase checkpoint
- `cursor-agent` and `ai-agent` packages need NO changes — callback signatures are unchanged
- The `LiveMessage` module handles all complexity (throttling, fallback, finalization)
