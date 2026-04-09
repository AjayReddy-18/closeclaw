# Tasks: Cursor CLI Agent Delegation

**Input**: Design documents from `/specs/007-cursor-cli-delegation/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: TDD approach required per constitution (Red-Green-Refactor, 90% coverage).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the `packages/cursor-agent` package and shared types

- [ ] T001 Create `packages/cursor-agent/` directory with `package.json`, `tsconfig.json`, `src/index.ts` (barrel) mirroring `packages/mcp-client` structure
- [ ] T002 Register `packages/cursor-agent` in `pnpm-workspace.yaml` and run `pnpm install`
- [ ] T003 [P] Define shared types (ExecutionMode, SessionStatus, CursorSession, PermissionRequest, SessionRecord, StreamJsonEvent, TaskResult) in `packages/cursor-agent/src/types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities that all user stories depend on — must complete before any story begins

### Tests for Foundational

- [ ] T004 [P] Write failing tests for cursor-availability (detect `agent` binary, detect `tmux`, detect auth) in `tests/unit/cursor-agent/cursor-availability.test.ts`
- [ ] T005 [P] Write failing tests for stream-json-parser (parse system/assistant/tool_call/result/error events, handle malformed lines) in `tests/unit/cursor-agent/stream-json-parser.test.ts`
- [ ] T006 [P] Write failing tests for tmux-controller (createSession, sendKeys, capturePane, killSession, sessionExists — all mocking `child_process.execFile`) in `tests/unit/cursor-agent/tmux-controller.test.ts`
- [ ] T007 [P] Write failing tests for permission-detector (detect approval prompts, ignore non-prompt output, extract prompt text) in `tests/unit/cursor-agent/permission-detector.test.ts`
- [ ] T008 [P] Write failing tests for session-store (save/load/prune from temp file, in-memory lookup, getActive by platform:senderId) in `tests/unit/cursor-agent/session-store.test.ts`

### Implementation for Foundational

- [ ] T009 [P] Implement `cursor-availability.ts` in `packages/cursor-agent/src/cursor-availability.ts` — detect `agent` binary via `which`, detect `tmux`, check `CURSOR_API_KEY` env
- [ ] T010 [P] Implement `stream-json-parser.ts` in `packages/cursor-agent/src/stream-json-parser.ts` — parse line-delimited JSON events from a Readable stream, emit typed StreamJsonEvent objects
- [ ] T011 [P] Implement `tmux-controller.ts` in `packages/cursor-agent/src/tmux-controller.ts` — shell out to tmux commands via injected exec function
- [ ] T012 [P] Implement `permission-detector.ts` in `packages/cursor-agent/src/permission-detector.ts` — regex-based detection of approval prompts in captured pane text
- [ ] T013 [P] Implement `session-store.ts` in `packages/cursor-agent/src/session-store.ts` — in-memory Map + temp file in `os.tmpdir()`, prune entries older than 24h on load
- [ ] T014 Update barrel exports in `packages/cursor-agent/src/index.ts`

**Checkpoint**: All foundational utilities pass their tests independently. Build succeeds.

---

## Phase 3: User Story 1 - Delegate a Coding Task (Priority: P1) — MVP

**Goal**: User sends a coding task via Telegram, CloseClaw spawns a Cursor agent in trust mode (--force), captures the result, and sends it back.

**Independent Test**: Send "use cursor to fix lint errors in /tmp/test-project" via bot, verify a Cursor process spawns and the result is delivered.

### Tests for User Story 1

- [ ] T015 [P] [US1] Write failing tests for trust-mode-runner (spawn with correct args, parse stream-json output, handle process exit, handle timeout, handle errors) in `tests/unit/cursor-agent/trust-mode-runner.test.ts`
- [ ] T016 [P] [US1] Write failing tests for session-manager start/cancel/getActive (delegates to trust-mode-runner, tracks session in store, enforces single-session-per-user, handles timeout cleanup) in `tests/unit/cursor-agent/session-manager.test.ts`
- [ ] T017 [P] [US1] Write failing tests for cursor_agent tool (Zod schema validation, calls session-manager.start, returns TaskResult, handles Cursor CLI not installed) in `tests/unit/ai-agent/cursor-agent-tool.test.ts`

### Implementation for User Story 1

- [ ] T018 [US1] Implement `trust-mode-runner.ts` in `packages/cursor-agent/src/trust-mode-runner.ts` — spawn `agent -p --force --output-format stream-json --stream-partial-output`, pipe stdout through stream-json-parser, call onProgress for assistant/tool_call events, resolve on result/exit, timeout with kill
- [ ] T019 [US1] Implement `session-manager.ts` in `packages/cursor-agent/src/session-manager.ts` — orchestrate start (availability check, single-session guard, delegate to runner, track in store), cancel (kill process/tmux, update status), getActive, listSessions
- [ ] T020 [US1] Implement `cursor_agent` tool in `packages/ai-agent/src/tools/cursor-agent-tool.ts` — Vercel AI SDK `tool()` with Zod schema (prompt, projectDir, mode), call session-manager.start, return formatted result
- [ ] T021 [US1] Add `buildCursorAgentSection` to `packages/ai-agent/src/system-prompt-builder.ts` — append Cursor Agent guidance when cursor tools are available (mode decision, when to use/not use)
- [ ] T022 [US1] Wire cursor tools into gateway startup in `packages/cli/src/commands/gateway-start.ts` — detect cursor availability, create session manager, build cursor tools, merge into extraTools, pass tool names for system prompt
- [ ] T023 [US1] Update barrel exports in `packages/cursor-agent/src/index.ts` and `packages/ai-agent/src/index.ts`

**Checkpoint**: User Story 1 complete — trust mode delegation works end-to-end. Run tests, lint, build.

---

## Phase 4: User Story 2 - Interactive Permission Forwarding (Priority: P1)

**Goal**: In safe mode, CloseClaw detects Cursor's permission prompts via tmux, forwards them to the user, and relays the accept/deny response back.

**Independent Test**: Run a Cursor task in safe mode, verify a permission prompt is forwarded to Telegram, reply "accept", verify the agent continues.

### Tests for User Story 2

- [ ] T024 [P] [US2] Write failing tests for safe-mode-runner (create tmux session, run agent command, poll capture-pane, detect permission prompt, forward and relay response, handle completion, handle timeout) in `tests/unit/cursor-agent/safe-mode-runner.test.ts`
- [ ] T025 [P] [US2] Write failing tests for session-manager safe mode path (delegates to safe-mode-runner when mode is "safe", permission callback wired correctly) in `tests/unit/cursor-agent/session-manager.test.ts` (extend existing)

### Implementation for User Story 2

- [ ] T026 [US2] Implement `safe-mode-runner.ts` in `packages/cursor-agent/src/safe-mode-runner.ts` — create tmux session, send `agent -p "{prompt}"`, poll capture-pane every 2s, use permission-detector to scan output, call onPermission callback when detected, send user decision via tmux send-keys, detect completion, timeout with tmux kill
- [ ] T027 [US2] Extend `session-manager.ts` to route to safe-mode-runner when `mode === "safe"` and handle waiting_approval status transitions
- [ ] T028 [US2] Add permission prompt interception to gateway message handler in `packages/gateway/src/gateway-agent-handler.ts` — when incoming message targets a user with an active cursor session in waiting_approval status, resolve the pending permission promise instead of routing to AI agent
- [ ] T029 [US2] Update barrel exports in `packages/cursor-agent/src/index.ts`

**Checkpoint**: User Story 2 complete — safe mode with permission forwarding works. Run tests, lint, build.

---

## Phase 5: User Story 3 - Live Progress Streaming (Priority: P2)

**Goal**: User receives periodic progress updates during Cursor task execution, throttled to avoid message spam.

**Independent Test**: Start a multi-step coding task, verify at least 2 intermediate progress messages arrive before the final result.

### Tests for User Story 3

- [ ] T030 [P] [US3] Write failing tests for progress throttling logic (no more than 1 message per 10s, heartbeat after 60s of no output) in `tests/unit/cursor-agent/trust-mode-runner.test.ts` (extend existing)

### Implementation for User Story 3

- [ ] T031 [US3] Add progress throttling to `trust-mode-runner.ts` — track last progress send time, skip if < 10s since last, send heartbeat after 60s of silence
- [ ] T032 [US3] Add progress throttling to `safe-mode-runner.ts` — same throttle logic for tmux captured output changes, heartbeat after 60s
- [ ] T033 [US3] Extract shared throttle utility if needed (DRY between trust/safe runners)

**Checkpoint**: User Story 3 complete — progress messages arrive at reasonable intervals. Run tests, lint, build.

---

## Phase 6: User Story 4 - Session Resume (Priority: P2)

**Goal**: User can resume an interrupted Cursor session from where it left off.

**Independent Test**: Start a task, cancel it, send "resume the last cursor task", verify it continues from previous state.

### Tests for User Story 4

- [ ] T034 [P] [US4] Write failing tests for cursor_resume tool (resume most recent, resume by chatId, handle no sessions, handle multiple sessions) in `tests/unit/ai-agent/cursor-resume-tool.test.ts`
- [ ] T035 [P] [US4] Write failing tests for session-manager resume path (lookup in store, fall back to agent ls, spawn with --resume flag) in `tests/unit/cursor-agent/session-manager.test.ts` (extend existing)

### Implementation for User Story 4

- [ ] T036 [US4] Implement `cursor_resume` tool in `packages/ai-agent/src/tools/cursor-resume-tool.ts` — Vercel AI SDK `tool()` with Zod schema (chatId optional), call session-manager.resume, return formatted result
- [ ] T037 [US4] Implement resume logic in `session-manager.ts` — lookup session in store, if not found parse `agent ls` output, spawn with `--resume=<chat-id>` flag (trust: spawn, safe: tmux)
- [ ] T038 [US4] Wire `cursor_resume` tool into gateway startup alongside `cursor_agent` in `packages/cli/src/commands/gateway-start.ts`

**Checkpoint**: User Story 4 complete — session resume works. Run tests, lint, build.

---

## Phase 7: User Story 5 - Execution Mode Selection (Priority: P3)

**Goal**: AI agent automatically picks the right execution mode based on task risk. User can override explicitly.

**Independent Test**: Send a lint-fix request (agent picks trust mode) vs. refactoring request (agent picks safe mode).

### Implementation for User Story 5

- [ ] T039 [US5] Refine the system prompt Cursor Agent section in `packages/ai-agent/src/system-prompt-builder.ts` to include explicit mode selection guidance with task risk examples
- [ ] T040 [US5] Verify the `cursor_agent` tool's Zod schema defaults `mode` to `"safe"` and the AI fills it based on prompt reasoning — no code change needed if already correct, otherwise adjust

**Checkpoint**: User Story 5 complete — mode selection is intelligent. Run tests, lint, build.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: CLI command, integration tests, documentation, final cleanup

- [ ] T041 [P] Implement `closeclaw cursor sessions` CLI command in `packages/cli/src/commands/cursor-sessions-command.ts` — list sessions from session store + `agent ls` fallback
- [ ] T042 [P] Register the `cursor sessions` subcommand in `packages/cli/src/index.ts`
- [ ] T043 [P] Write integration test for end-to-end delegation flow (mocked Cursor CLI + mocked bot adapter) in `tests/integration/cursor-delegation-flow.test.ts`
- [ ] T044 [P] Write user-facing documentation in `docs/cursor-agent.md` — prerequisites, usage, modes, resume, configuration, examples
- [ ] T045 [P] Update `docs/cli-reference.md` with the new `cursor sessions` command
- [ ] T046 Run full test suite, lint, format check, build all packages, verify 90% coverage
- [ ] T047 Rebuild dist/ artifacts for all changed packages

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 - Delegate Task (Phase 3)**: Depends on Foundational — MVP, must complete first
- **US2 - Permission Forwarding (Phase 4)**: Depends on US1 (extends session-manager and adds safe-mode-runner)
- **US3 - Live Progress (Phase 5)**: Depends on US1 (extends trust-mode-runner and safe-mode-runner)
- **US4 - Session Resume (Phase 6)**: Depends on US1 (extends session-manager and adds resume tool)
- **US5 - Mode Selection (Phase 7)**: Depends on US2 (safe mode must exist for mode selection to matter)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational — can start immediately after Phase 2
- **US2 (P1)**: Depends on US1 — extends session-manager with safe-mode path
- **US3 (P2)**: Depends on US1 — can start after US1, independent of US2
- **US4 (P2)**: Depends on US1 — can start after US1, independent of US2/US3
- **US5 (P3)**: Depends on US2 — mode selection needs both modes to exist

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Red-Green-Refactor)
- Types/utilities before runners
- Runners before session-manager
- Session-manager before tools
- Tools before wiring
- Story complete before moving to next priority

### Parallel Opportunities

- All Foundational tests (T004–T008) can run in parallel
- All Foundational implementations (T009–T013) can run in parallel
- US3 and US4 can run in parallel after US1 completes
- All Polish tasks (T041–T045) can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Launch all foundational tests together:
Task: "Tests for cursor-availability in tests/unit/cursor-agent/cursor-availability.test.ts"
Task: "Tests for stream-json-parser in tests/unit/cursor-agent/stream-json-parser.test.ts"
Task: "Tests for tmux-controller in tests/unit/cursor-agent/tmux-controller.test.ts"
Task: "Tests for permission-detector in tests/unit/cursor-agent/permission-detector.test.ts"
Task: "Tests for session-store in tests/unit/cursor-agent/session-store.test.ts"

# Then launch all foundational implementations together:
Task: "cursor-availability.ts in packages/cursor-agent/src/cursor-availability.ts"
Task: "stream-json-parser.ts in packages/cursor-agent/src/stream-json-parser.ts"
Task: "tmux-controller.ts in packages/cursor-agent/src/tmux-controller.ts"
Task: "permission-detector.ts in packages/cursor-agent/src/permission-detector.ts"
Task: "session-store.ts in packages/cursor-agent/src/session-store.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (trust mode delegation)
4. **STOP and VALIDATE**: Test with real Cursor CLI — send a task via Telegram, verify result comes back
5. Commit and verify coverage

### Incremental Delivery

1. Setup + Foundational — Package and utilities ready
2. US1: Trust Mode Delegation — MVP! Users can delegate coding tasks
3. US2: Permission Forwarding — Safe mode adds safety for risky tasks
4. US3 + US4 (parallel): Live Progress + Session Resume — Better UX
5. US5: Mode Selection — Agent intelligence for auto-picking modes
6. Polish: CLI command, docs, integration tests

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (Red-Green-Refactor)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
