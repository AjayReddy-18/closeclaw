# Tasks: Persistent Conversation Storage

**Input**: Design documents from `/specs/003-persistent-memory/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: TDD approach — write tests first per constitution Principle I.

**Organization**: Tasks grouped by user story (US1–US4) for independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Shared type updates and infrastructure that all stories depend on

- [x] T001 Add `compressionThreshold` (default: 50) and `keepRecentCount` (default: 20) fields to AgentConfig in packages/shared-types/src/agent-config.ts and update `isValidAgentConfig` validator
- [x] T002 Add `compressedSummary` optional field to `Conversation` interface in packages/ai-agent/src/conversation-types.ts (fields: text, messagesCompressed, compressedAt)
- [x] T003 [P] Add `ConversationFileData`, `PreferenceEntry`, and `PreferenceFileData` type definitions in packages/ai-agent/src/persistence-types.ts
- [x] T004 [P] Add serialization helpers (Conversation ↔ ConversationFileData, Date ↔ ISO string) in packages/ai-agent/src/persistence-serializer.ts

**Checkpoint**: Types are defined, existing tests still pass

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core persistence I/O that all user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Write unit tests for conversation file read/write/remove (atomic writes, corrupted file handling, missing file returns null) in tests/unit/ai-agent/conversation-persistence.test.ts
- [x] T006 Implement `createConversationPersistence` factory (load, save with atomic tmp+rename, remove) in packages/ai-agent/src/conversation-persistence.ts
- [x] T007 [P] Write unit tests for preference file read/write/upsert/remove (upsert deduplicates by key, removePreference returns boolean) in tests/unit/ai-agent/preference-store.test.ts
- [x] T008 [P] Implement `createPreferenceStore` factory (load, save, upsertPreference, removePreference) in packages/ai-agent/src/preference-store.ts
- [x] T009 Update existing tests for AgentConfig in tests/unit/shared-types/agent-config.test.ts to cover new `compressionThreshold` and `keepRecentCount` fields

**Checkpoint**: Persistence I/O is tested and working; can read/write JSON files atomically

---

## Phase 3: User Story 1 — Conversations Survive Gateway Restarts (P1) 🎯 MVP

**Goal**: Conversations persist to disk and are restored on gateway restart

**Independent Test**: Start gateway, chat, stop, restart, send follow-up — bot has prior context

### Tests for US1

- [x] T010 [US1] Write unit tests for persistent conversation store wrapper (getOrCreate loads from disk on first call, save writes after each exchange, clear removes file, pruneStale removes disk files) in tests/unit/ai-agent/persistent-conversation-store.test.ts
- [x] T011 [US1] Write integration test for save → restart → load cycle (create store, add messages, create new store from same path, verify messages restored) in tests/integration/ai-agent/persistence-flow.test.ts

### Implementation for US1

- [x] T012 [US1] Implement `createPersistentConversationStore` wrapper in packages/ai-agent/src/persistent-conversation-store.ts — wraps in-memory store, lazy-loads from disk on getOrCreate, saves after mutations, delegates clear to remove file + in-memory clear, delegates pruneStale to also delete disk files
- [x] T013 [US1] Update `createMessageProcessor` in packages/ai-agent/src/message-processor.ts — after invokeModel returns, call a `postProcessHook` callback (injected via deps) that the gateway uses to trigger disk save
- [x] T014 [US1] Update `gateway-start.ts` in packages/cli/src/commands/gateway-start.ts — replace `createConversationStore()` with `createPersistentConversationStore()`, passing `~/.closeclaw/conversations/` as the base directory
- [x] T015 [US1] Export new modules from packages/ai-agent/src/index.ts (persistence types, persistent store, serializer)
- [x] T016 [US1] Handle "/clear" disk cleanup — when `clear()` is called on persistent store, delete the conversation file from disk but NOT the preference file

**Checkpoint**: Conversations survive gateway restarts. MVP is functional.

---

## Phase 4: User Story 2 — Automatic History Compression (P2)

**Goal**: Older messages are automatically summarized when conversation grows past threshold

**Independent Test**: Send 51+ messages, verify older messages are replaced by a summary in the file, verify AI still references compressed facts

### Tests for US2

- [x] T017 [US2] Write unit tests for conversation compressor (shouldCompress returns true when count > threshold, compress generates summary via AI, rolling summary merges with existing summary) in tests/unit/ai-agent/conversation-compressor.test.ts

### Implementation for US2

- [x] T018 [US2] Implement `createConversationCompressor` in packages/ai-agent/src/conversation-compressor.ts — `shouldCompress(count)` checks against threshold, `compress(messages, existingSummary?)` calls generateText with a summarization prompt, returns summary string
- [x] T019 [US2] Wire compression into persistent store in packages/ai-agent/src/persistent-conversation-store.ts — after save, check shouldCompress; if true, schedule compression via `queueMicrotask` (non-blocking), replace older messages with summary and save again
- [x] T020 [US2] Update `sdkMessagesForGenerate` in packages/ai-agent/src/message-processor.ts — if conversation has a compressedSummary, prepend it as a system message before the recent messages so the AI has context from compressed history

**Checkpoint**: Compression works end-to-end. Long conversations stay bounded.

---

## Phase 5: User Story 3 — User Preference Memory (P3)

**Goal**: AI automatically identifies and stores user preferences; preferences are injected into every AI context

**Independent Test**: Tell bot a preference, restart gateway, ask about it — bot remembers

### Tests for US3

- [x] T021 [US3] Write unit tests for save_preference and forget_preference tools (tool definitions, execute writes/removes preferences) in tests/unit/ai-agent/preference-tools.test.ts
- [x] T022 [P] [US3] Write unit tests for preference injection into AI context (preferences formatted and appended to system prompt) in tests/unit/ai-agent/preference-injection.test.ts

### Implementation for US3

- [x] T023 [US3] Implement `createSavePreferenceTool` and `createForgetPreferenceTool` AI tools in packages/ai-agent/src/tools/preference-tools.ts — save_preference takes key/value and calls preferenceStore.upsertPreference; forget_preference takes key and calls preferenceStore.removePreference
- [x] T024 [US3] Implement `formatPreferencesForContext` helper in packages/ai-agent/src/preference-injection.ts — loads preferences from PreferenceStore, formats as a string block (e.g., "User preferences:\n- name: Ajay\n- timezone: IST"), returns empty string if no preferences
- [x] T025 [US3] Wire preference tools into `buildToolMap` in packages/ai-agent/src/tool-executor.ts — when tool calling is enabled, always include save_preference and forget_preference tools alongside existing tools
- [x] T026 [US3] Wire preference context into `sdkMessagesForGenerate` in packages/ai-agent/src/message-processor.ts — inject preference text into the system prompt so AI has access to stored preferences
- [x] T027 [US3] Pass PreferenceStore to `createMessageProcessor` deps in packages/ai-agent/src/message-processor.ts and through gateway-start.ts

**Checkpoint**: Preferences are extracted, stored, and used. Bot personalizes responses.

---

## Phase 6: User Story 4 — Memory Flush Before Compression (P4)

**Goal**: Before compression, important facts are extracted and saved to preferences

**Independent Test**: Share a preference early, trigger compression, verify preference was preserved in preference file

### Tests for US4

- [x] T028 [US4] Write unit tests for memory flush (AI extracts preferences from messages, preferences written to store, errors don't block compression) in tests/unit/ai-agent/memory-flush.test.ts

### Implementation for US4

- [x] T029 [US4] Implement `createMemoryFlusher` in packages/ai-agent/src/memory-flush.ts — sends about-to-be-compressed messages to AI with extraction prompt, parses response into PreferenceEntry array, writes each to PreferenceStore
- [x] T030 [US4] Wire memory flush into compression flow in packages/ai-agent/src/persistent-conversation-store.ts — before calling compressor.compress, call flusher.extractPreferences (wrapped in try/catch so errors are best-effort)

**Checkpoint**: Memory flush prevents data loss during compression.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, validation

- [x] T031 Update docs/ai-agent.md with sections on persistence (file locations, lazy loading), compression (threshold, summary), preferences (automatic extraction, /clear behavior, forget), and memory flush
- [x] T032 Run full test suite: `pnpm test`
- [x] T033 Run coverage check: `pnpm test:coverage` (must meet ≥90% threshold)
- [x] T034 Run lint and format: `pnpm lint && pnpm format:check`
- [x] T035 Build all packages: `pnpm build`
- [x] T036 Commit all changes following Conventional Commits (atomic commits per phase)
- [ ] T037 Verify app end-to-end per quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 types — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 persistence I/O — **MVP**
- **US2 (Phase 4)**: Depends on US1 (persistent store to compress into)
- **US3 (Phase 5)**: Depends on Phase 2 (preference store I/O); can run in parallel with US2
- **US4 (Phase 6)**: Depends on US2 (compression) + US3 (preference store)
- **Polish (Phase 7)**: Depends on all stories complete

### User Story Dependencies

- **US1 (P1)**: Needs Phase 2 complete — no dependency on other stories
- **US2 (P2)**: Needs US1 complete (persistent store to write summaries to)
- **US3 (P3)**: Needs Phase 2 complete — can run in parallel with US2
- **US4 (P4)**: Needs both US2 and US3 complete

### Within Each Story

- Tests MUST be written and FAIL before implementation
- Types/models before services
- Services before integration
- Core implementation before wiring

### Parallel Opportunities

- T003 and T004 can run in parallel (different files, no dependencies)
- T005/T006 and T007/T008 can run in parallel (conversation persistence vs preference store)
- T021 and T022 can run in parallel (preference tool tests vs injection tests)
- US2 and US3 can be developed in parallel after US1 (different subsystems)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup types (T001–T004)
2. Complete Phase 2: Foundational persistence I/O (T005–T009)
3. Complete Phase 3: US1 — persistent conversations (T010–T016)
4. **STOP and VALIDATE**: Test US1 independently per quickstart.md Step 1
5. Deploy/demo if ready — conversations now survive restarts

### Incremental Delivery

1. Setup + Foundational → persistence infra ready
2. US1 → conversations survive restarts → **MVP** ✓
3. US2 → compression handles growth → Demo compression
4. US3 → preferences personalize responses → Demo preferences
5. US4 → flush prevents data loss during compression → Demo full cycle
6. Polish → docs, coverage, verification → Feature complete

### Suggested Execution

Sequential for safest delivery: Phase 1 → Phase 2 → US1 → US2 → US3 → US4 → Polish

Parallel opportunity: After US1, run US2 and US3 in parallel (they don't depend on each other), then US4 after both are done.
