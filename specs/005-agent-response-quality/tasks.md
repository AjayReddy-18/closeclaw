# Tasks: Agent Response Quality

**Input**: Design documents from `/specs/005-agent-response-quality/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Phase 1: Foundational (Shared Infrastructure)

**Purpose**: Data model changes and adapter interface updates needed before any user story can proceed

- [ ] T001 [US1] Add `lastDeliveredAt` field to `ScheduledTask` in `packages/ai-agent/src/scheduler/task-types.ts` and update task store serialization in `packages/ai-agent/src/scheduler/task-store.ts`
- [ ] T002 [US1] Extend `BotAdapter.sendMessage` signature to accept optional `{ parseMode?: "HTML" }` in `packages/bot-adapters/src/adapter.ts`; update `TelegramAdapter.sendMessage` in `packages/bot-adapters/src/telegram-adapter.ts` to pass `parse_mode` to grammY; update `DiscordAdapter.sendMessage` in `packages/bot-adapters/src/discord-adapter.ts` to ignore it
- [ ] T003 [US1] Update existing `telegram-adapter.test.ts` and `discord-adapter.test.ts` to cover new `sendMessage` options parameter

**Checkpoint**: Adapter interface is ready. Data model updated. All existing tests still pass.

---

## Phase 2: User Story 1 — Telegram-Friendly Response Formatting (Priority: P1)

**Goal**: AI responses render properly in Telegram with bold, code blocks, links, and lists instead of raw markdown symbols

**Independent Test**: Send prompts that produce markdown-heavy responses and verify Telegram renders them with proper formatting

### Tests for User Story 1

> **Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T004 [P] [US1] Unit test for markdown-to-telegram converter in `tests/unit/bot-adapters/formatter/markdown-to-telegram.test.ts` — cover headers, bold, italic, strikethrough, inline code, code blocks (with language), links, blockquotes, tables, lists, horizontal rules, HTML entity escaping, malformed/unclosed markdown, emoji passthrough
- [ ] T005 [P] [US1] Unit test for message splitter in `tests/unit/bot-adapters/formatter/message-splitter.test.ts` — cover under-limit passthrough, paragraph-boundary splitting, line-boundary fallback, hard-split fallback, HTML tag repair across splits, empty input
- [ ] T006 [P] [US1] Contract test for Telegram HTML structure in `tests/contract/telegram-format.test.ts` — validate output only contains Telegram-supported HTML tags, all `<>&` are properly escaped outside tags, no unclosed tags
- [ ] T007 [US1] Integration test for end-to-end formatting flow in `tests/integration/response-formatting-flow.test.ts` — mock adapter receives formatted HTML with `parseMode: "HTML"`, long messages arrive as multiple chunks

### Implementation for User Story 1

- [ ] T008 [US1] Create markdown-to-telegram converter in `packages/bot-adapters/src/formatter/markdown-to-telegram.ts` — implement `formatForTelegram(markdown: string): FormatterResult` following conversion rules from research.md R2 (code blocks first, then inline code, block-level, inline formatting, escaping)
- [ ] T009 [US1] Create message splitter in `packages/bot-adapters/src/formatter/message-splitter.ts` — implement `splitMessage(formatted: FormatterResult, maxLength?: number): MessageChunk[]` following algorithm from research.md R3 (paragraph boundaries → line boundaries → hard split with tag repair)
- [ ] T010 [US1] Create formatter barrel export in `packages/bot-adapters/src/formatter/index.ts` and add to `packages/bot-adapters/src/index.ts`
- [ ] T011 [US1] Wire formatting into `TelegramAdapter.sendMessage` in `packages/bot-adapters/src/telegram-adapter.ts` — call `formatForTelegram` + `splitMessage`, send each chunk with `parse_mode: "HTML"`, fall back to plain text on API rejection (FR-015)
- [ ] T012 [US1] Wire formatting into gateway delivery in `packages/gateway/src/gateway-agent-handler.ts` — `sendSuccessReply` passes response through adapter (adapter handles formatting internally)

**Checkpoint**: Telegram messages render with proper bold, code blocks, links. Long messages split cleanly. Discord unchanged.

---

## Phase 3: User Story 2 — Smart Scheduled Task Response Suppression (Priority: P1)

**Goal**: Scheduled monitoring tasks only notify the user on completion, failure, or significant changes — not every poll

**Independent Test**: Schedule a monitoring task, have the AI return "still in progress" multiple times, verify only the final "done" message is delivered

### Tests for User Story 2

> **Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T013 [P] [US2] Unit test for suppression filter in `tests/unit/ai-agent/scheduler/suppression-filter.test.ts` — cover: structured prefix detection (TASK_COMPLETE, TASK_FAILED, TASK_IN_PROGRESS), prefix stripping, keyword heuristic fallback for delivery signals, keyword heuristic fallback for suppression signals, ambiguous response with safety valve expired (>30 min), ambiguous response within safety valve (<30 min), HEARTBEAT_OK handling, edge cases (empty response, very short response)
- [ ] T014 [US2] Integration test for suppression flow in `tests/integration/scheduler-suppression-flow.test.ts` — mock executor returns "in progress" 3 times then "TASK_COMPLETE: done", verify only the final response is delivered; verify safety valve delivers after configurable timeout

### Implementation for User Story 2

- [ ] T015 [US2] Create suppression filter in `packages/ai-agent/src/scheduler/suppression-filter.ts` — implement `evaluateResponse(response: string, context: SuppressionContext): SuppressionResult` with prefix-first → keyword-fallback → safety-valve logic per research.md R4+R6
- [ ] T016 [US2] Wire suppression into task scheduler `executeAndRecord` in `packages/ai-agent/src/scheduler/task-scheduler.ts` — before calling `deliver()`, run `evaluateResponse()`; if suppressed, log and skip delivery; if delivering, use `cleanedResponse` (stripped prefix); update `lastDeliveredAt` on task after successful delivery
- [ ] T017 [US2] Update `scheduler-setup.ts` deliver function in `packages/cli/src/commands/scheduler-setup.ts` — ensure `lastDeliveredAt` is available to the suppression context when evaluating
- [ ] T018 [US2] Export new module from `packages/ai-agent/src/index.ts`

**Checkpoint**: Monitoring tasks suppress "still running" messages. Only completions, failures, and safety-valve updates are delivered.

---

## Phase 4: User Story 3 — Enhanced Agent System Prompt (Priority: P2)

**Goal**: The AI agent produces concise, well-formatted, tool-aware responses guided by a rich built-in system prompt

**Independent Test**: Compare response quality — simple questions get 1-3 sentence answers, agent uses tools proactively, no "Great question!" filler

### Tests for User Story 3

> **Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T019 [P] [US3] Unit test for system prompt builder in `tests/unit/ai-agent/system-prompt-builder.test.ts` — cover: built-in prompt always present, user custom prompt prepended as owner instructions, sender identity injected, preference context injected, conversation summary injected, empty user prompt handled, prompt contains all expected sections (identity, response style, platform awareness, tool usage, scheduling behavior)
- [ ] T020 [P] [US3] Update ai-invoker tests in `tests/unit/ai-agent/ai-invoker.test.ts` — verify `buildSystemPrompt` now delegates to the new builder, verify the assembled prompt structure

### Implementation for User Story 3

- [ ] T021 [US3] Create system prompt builder in `packages/ai-agent/src/system-prompt-builder.ts` — implement `buildFullSystemPrompt(parts: SystemPromptParts): string` with sections: Identity, Response Style, Platform Awareness, Tool Usage, Scheduling Behavior, Preferences (per research.md R5)
- [ ] T022 [US3] Update `DEFAULT_SYSTEM_PROMPT` in `packages/shared-types/src/agent-config.ts` — change default to empty string (built-in prompt is always present from the builder; user prompt becomes "additional instructions")
- [ ] T023 [US3] Refactor `buildSystemPrompt` in `packages/ai-agent/src/ai-invoker.ts` to use the new `buildFullSystemPrompt` — pass user's `config.systemPrompt` as `userCustomPrompt`, existing `senderIdentity`/`preferenceContext`/`summaryText` as their respective fields
- [ ] T024 [US3] Export new module from `packages/ai-agent/src/index.ts`

**Checkpoint**: Agent responses are concise, direct, and context-aware. Custom user prompts still work.

---

## Phase 5: User Story 4 — Response Length Control via Preferences (Priority: P3)

**Goal**: Users can adjust agent verbosity through natural language, and the preference persists across sessions

**Independent Test**: Tell the agent "keep answers short" and verify it responds more concisely

### Implementation for User Story 4

- [ ] T025 [US4] Update system prompt in `packages/ai-agent/src/system-prompt-builder.ts` — add guidance in the Preferences section that the agent should respect `response_style` preference (if present) and proactively save it when the user expresses a preference for brevity or detail using the `save_preference` tool
- [ ] T026 [US4] Verify existing preference injection in `packages/ai-agent/src/preference-injection.ts` already surfaces `response_style` to the system prompt (no code change expected; just validate in test)

**Checkpoint**: User can say "be brief" and the agent remembers. No new storage needed.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, coverage, edge cases, and final validation

- [ ] T027 [P] Update `docs/ai-agent.md` — add section on enhanced system prompt, response style, formatting behavior
- [ ] T028 [P] Update `docs/scheduled-automation.md` — add section on smart suppression behavior and structured prefix protocol
- [ ] T029 [P] Create `docs/response-formatting.md` — document Telegram formatting conversion, message splitting, platform differences, fallback behavior
- [ ] T030 Update `docs/cli-reference.md` — if any new CLI commands or options were added
- [ ] T031 Run `specs/005-agent-response-quality/quickstart.md` validation — verify all three features work end-to-end
- [ ] T032 Ensure test coverage meets 90% threshold for all new modules
- [ ] T033 Build all packages (`pnpm build`) and verify no regressions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies — start immediately
- **Phase 2 (US1 Formatting)**: Depends on Phase 1 (T002 adapter interface)
- **Phase 3 (US2 Suppression)**: Depends on Phase 1 (T001 data model) — can run in parallel with Phase 2
- **Phase 4 (US3 System Prompt)**: No dependency on Phase 1/2/3 — can run in parallel
- **Phase 5 (US4 Preferences)**: Depends on Phase 4 (prompt builder exists)
- **Phase 6 (Polish)**: Depends on all previous phases

### Parallel Opportunities

- **T004, T005, T006** can run in parallel (different test files, no shared state)
- **T013, T019, T020** can run in parallel (different test files)
- **Phase 2 and Phase 3** can run in parallel after Phase 1
- **Phase 4** can start immediately (no foundational dependency)
- **T027, T028, T029** can run in parallel (different doc files)

### Within Each Phase

- Tests MUST be written first and FAIL before implementation
- Implementation tasks are sequential within each phase (later tasks depend on earlier)
- Commit after each task or logical group

---

## Implementation Strategy

### MVP First (Phase 1 + Phase 2)

1. Complete Phase 1: Adapter interface + data model
2. Complete Phase 2: Telegram formatting
3. **STOP and VALIDATE**: Send messages in Telegram, verify rendering
4. This alone solves the most visible user complaint

### Incremental Delivery

1. Phase 1 + Phase 2 → Telegram formatting works (MVP)
2. Phase 3 → Suppression stops notification spam
3. Phase 4 → Better AI behavior across the board
4. Phase 5 → Personalization polish
5. Phase 6 → Docs and final validation

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [US#] label maps task to its specific user story
- No new npm dependencies required — formatter is pure TypeScript
- Telegram HTML is used over MarkdownV2 (see research.md R1)
- The suppression filter uses a prefix-first protocol (TASK_COMPLETE/TASK_IN_PROGRESS/TASK_FAILED) with keyword fallback (see research.md R6)
- Commit after each task or logical group of tasks
