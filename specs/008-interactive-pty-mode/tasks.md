# Tasks: Interactive PTY Mode for Cursor Agent

**Input**: Design documents from `/specs/008-interactive-pty-mode/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDD approach — constitution mandates failing tests first.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install node-pty, update types, remove deprecated tmux code

- [x] T001 Add `node-pty` dependency to `packages/cursor-agent/package.json` and run `pnpm install`
- [x] T002 [P] Add PTY-related types (`PtySpawnOptions`, `ProgressEvent`, `PermissionPrompt`, `InteractiveTaskResult`) to `packages/cursor-agent/src/types.ts`
- [x] T003 [P] Update `ExecutionMode` type from `"safe" | "trust"` to `"interactive" | "trust"` in `packages/cursor-agent/src/types.ts`
- [x] T004 Remove `packages/cursor-agent/src/tmux-controller.ts` and its test `tests/unit/cursor-agent/tmux-controller.test.ts`
- [x] T005 [P] Remove `packages/cursor-agent/src/safe-mode-runner.ts` and its test `tests/unit/cursor-agent/safe-mode-runner.test.ts`
- [x] T006 Remove tmux/safe-mode exports from `packages/cursor-agent/src/index.ts` (remove `createTmuxController`, `TmuxController`, `ShellExec`, `runSafeMode`, `SafeModeRunnerDeps`, `TMUX_CAPTURE_LINES`)
- [x] T007 Update `packages/cursor-agent/src/cursor-availability.ts` — remove `tmuxInstalled` and `safeModeAvailable` fields, add `ptyAvailable` field (check if node-pty can be loaded)
- [x] T008 Update `tests/unit/cursor-agent/cursor-availability.test.ts` to reflect new availability shape (no tmux, add pty check)

**Checkpoint**: node-pty installed, tmux code removed, types updated, all existing tests still pass

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the three low-level PTY modules that all user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

### Tests (write FIRST, must FAIL before implementation)

- [x] T009 [P] Write unit tests for PTY spawner in `tests/unit/cursor-agent/pty-spawner.test.ts` — test spawn with options, onData callback, write input, kill, onExit callback (mock node-pty)
- [x] T010 [P] Write unit tests for ANSI output parser in `tests/unit/cursor-agent/pty-output-parser.test.ts` — test stripAnsi (color codes, cursor movement, OSC sequences), extractLines from raw chunks with partial line buffering
- [x] T011 [P] Write unit tests for PTY permission detector in `tests/unit/cursor-agent/pty-permission-detector.test.ts` — test detection of "Accept Deny", "(Y/n)", workspace trust prompt, no false positives on normal text

### Implementation

- [x] T012 [P] Implement PTY spawner in `packages/cursor-agent/src/pty-spawner.ts` — DI wrapper around node-pty `spawn()`, returns `PtyHandle` interface (onData, onExit, write, kill, resize)
- [x] T013 [P] Implement ANSI output parser in `packages/cursor-agent/src/pty-output-parser.ts` — `stripAnsi()` function (regex-based), `extractLines()` with internal buffer for partial lines
- [x] T014 [P] Implement PTY permission detector in `packages/cursor-agent/src/pty-permission-detector.ts` — `detectPermission(recentLines)` returns `DetectedPermission | null`, patterns from research.md + existing `permission-detector.ts` patterns
- [x] T015 Export new modules from `packages/cursor-agent/src/index.ts` (`createPtySpawner`, `PtyHandle`, `stripAnsi`, `extractLines`, `detectPtyPermission`, `DetectedPermission`)

**Checkpoint**: Three foundational modules implemented with passing tests, exported from package

---

## Phase 3: User Story 1 — Real-Time Progress Visibility (Priority: P1) MVP

**Goal**: When a user delegates a coding task, they see clean, throttled progress messages in Telegram showing what Cursor is doing in real time.

**Independent Test**: Delegate any coding task via Telegram and verify periodic human-readable status messages appear showing file operations, commands, and agent reasoning.

### Tests for User Story 1

- [x] T016 [P] [US1] Write unit tests for interactive runner in `tests/unit/cursor-agent/interactive-runner.test.ts` — test PTY spawn, output parsing to progress events, throttled onProgress calls, exit handling (success/failure/timeout)
- [x] T017 [P] [US1] Write integration test for PTY interactive flow in `tests/integration/pty-interactive-flow.test.ts` — test full lifecycle: spawn mock PTY → emit output → verify progress callbacks fired → process exits → verify task result

### Implementation for User Story 1

- [x] T018 [US1] Implement interactive runner in `packages/cursor-agent/src/interactive-runner.ts` — orchestrates PTY spawn, wires onData → stripAnsi → extractLines → classify as progress vs prompt, throttles progress at PROGRESS_THROTTLE_MS, handles exit/timeout/kill
- [x] T019 [US1] Update session manager in `packages/cursor-agent/src/session-manager.ts` — change default mode from `"safe"` to `"interactive"`, add `runInteractive` dep, route interactive mode to new runner and trust mode to existing runner, remove `runSafe` dep and `SAFE_MODE_PREFIX`
- [x] T020 [US1] Update `tests/unit/cursor-agent/session-manager.test.ts` — update tests for interactive as default, remove safe mode tests, add interactive runner delegation test
- [x] T021 [US1] Update cursor-agent tool schema in `packages/ai-agent/src/tools/cursor-agent-tool.ts` — change `mode` default from `"safe"` to `"interactive"`, update `z.enum` from `["safe", "trust"]` to `["interactive", "trust"]`
- [x] T022 [US1] Update `packages/cli/src/commands/cursor-setup.ts` — remove `buildSafeRunner`, `buildTmuxExec`, `isSessionDone`, tmux imports; add `buildPtySpawner` that creates a `PtySpawnFn` using node-pty; wire `runInteractive` to session manager deps
- [x] T023 [US1] Update `packages/cursor-agent/src/cursor-availability.ts` exports and `packages/cursor-agent/src/index.ts` — export `runInteractiveMode` and its types
- [x] T024 [US1] Update system prompt in `packages/ai-agent/src/system-prompt-builder.ts` — change CURSOR_AGENT_GUIDANCE to replace "safe" with "interactive" as the default mode, update mode descriptions

**Checkpoint**: User Story 1 complete — delegating a task produces real-time progress messages via PTY. Trust mode still works as explicit override.

---

## Phase 4: User Story 2 — Interactive Permission Control (Priority: P1)

**Goal**: When Cursor requests permission for a risky action, the user sees the prompt in Telegram with Accept/Deny options, responds, and Cursor respects the decision. Auto-deny after 2-minute timeout.

**Independent Test**: Delegate a task that triggers a Cursor permission prompt, verify prompt appears in Telegram, respond Accept or Deny, confirm Cursor proceeds or skips accordingly.

### Tests for User Story 2

- [x] T025 [P] [US2] Write unit tests for permission relay in `tests/unit/cursor-agent/interactive-runner.test.ts` — add tests for: prompt detected → onPermission called → accept writes "Y\r" to PTY → deny writes "n\r", auto-deny after APPROVAL_TIMEOUT_MS
- [x] T026 [P] [US2] Write integration test for permission flow in `tests/integration/pty-interactive-flow.test.ts` — add tests for: full permission round-trip (detect → callback → write → resume), timeout auto-deny

### Implementation for User Story 2

- [x] T027 [US2] Enhance interactive runner permission handling in `packages/cursor-agent/src/interactive-runner.ts` — when `detectPermission` returns a match, pause progress, call `onPermission(displayText)` with 2-minute timeout, write user's decision keystroke (`Y\r` or `n\r`) to PTY, track permission stats (requested/accepted/denied), resume progress streaming
- [x] T028 [US2] Wire permission forwarding in `packages/gateway/src/gateway-agent-handler.ts` — implement `onPermission` callback that sends prompt text to user via `adapter.sendMessage`, waits for next user message matching accept/deny pattern, returns decision
- [x] T029 [US2] Update `packages/cli/src/commands/agent-init.ts` — wire the gateway-level `onPermission` callback through to cursor tools, ensure it reaches the interactive runner
- [x] T030 [US2] Update `tests/unit/cursor-agent/interactive-runner.test.ts` — verify permission stats are included in `InteractiveTaskResult` (permissionsRequested, permissionsAccepted, permissionsDenied)

**Checkpoint**: User Story 2 complete — permission prompts relay to Telegram and back, auto-deny on timeout, permission stats tracked.

---

## Phase 5: User Story 3 — Clean Final Summary (Priority: P2)

**Goal**: When Cursor finishes a task, the user gets a structured summary of files created/modified, commands run, and outcome.

**Independent Test**: Delegate a task to completion, verify final message includes structured list of changes and overall status.

### Tests for User Story 3

- [x] T031 [P] [US3] Write unit tests for summary builder in `tests/unit/cursor-agent/interactive-runner.test.ts` — add tests for: extract file paths from output, build structured summary from outputLog, handle failure/timeout summary

### Implementation for User Story 3

- [x] T032 [US3] Implement summary extraction in `packages/cursor-agent/src/interactive-runner.ts` — parse accumulated output lines to identify file operations (created/modified/deleted), commands run, and errors; build a structured summary string
- [x] T033 [US3] Format summary for Telegram in `packages/ai-agent/src/tools/cursor-agent-tool.ts` — format the `InteractiveTaskResult` into a clean message with file list, permission stats, and outcome before returning to the AI agent

**Checkpoint**: User Story 3 complete — task completion produces a structured, readable summary.

---

## Phase 6: User Story 4 — Session Resume After Interruption (Priority: P3)

**Goal**: If a Cursor session is interrupted or the user wants to continue, they can resume from where it left off.

**Independent Test**: Start a task, interrupt, ask to resume, verify continuity.

### Tests for User Story 4

- [x] T034 [P] [US4] Write unit tests for resume in `tests/unit/cursor-agent/session-manager.test.ts` — add tests for: resume with captured sessionId spawns PTY with `--resume=<chatId>`, resume with no sessions returns error

### Implementation for User Story 4

- [x] T035 [US4] Update resume logic in `packages/cursor-agent/src/session-manager.ts` — use `runInteractive` for resume (spawn PTY with `--resume=<chatId>` flag), pass onProgress and onPermission callbacks so resumed sessions are also interactive
- [x] T036 [US4] Update resume tool in `packages/ai-agent/src/tools/cursor-resume-tool.ts` — ensure resume uses interactive runner by default

**Checkpoint**: User Story 4 complete — sessions can be resumed interactively.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, documentation, coverage, and final validation

- [x] T037 [P] Remove old `packages/cursor-agent/src/permission-detector.ts` (replaced by `pty-permission-detector.ts`) and its test `tests/unit/cursor-agent/permission-detector.test.ts`
- [x] T038 [P] Remove `packages/cursor-agent/src/progress-throttle.ts` (throttling now in interactive-runner) and its test `tests/unit/cursor-agent/progress-throttle.test.ts`
- [x] T039 [P] Update `tests/integration/cursor-delegation-flow.test.ts` — update mocks and assertions for interactive mode as default, remove safe mode test cases
- [x] T040 [P] Update `tests/unit/cli/gateway-start.test.ts` — update cursor setup mocks (no tmux, no safe runner)
- [x] T041 Update `packages/cursor-agent/src/index.ts` — remove deprecated exports (`progress-throttle`, `permission-detector`), verify all new exports are present
- [x] T042 [P] Update `docs/cursor-agent.md` — document interactive PTY mode as default, trust mode as override, permission prompts, progress streaming, prerequisites (node-pty)
- [x] T043 Run `pnpm test` — verify 90%+ coverage across all packages
- [x] T044 Run `pnpm lint && pnpm format:check` — verify zero violations
- [x] T045 Run quickstart.md validation — manually verify gateway starts with `[cursor] Interactive PTY mode available`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (types + node-pty installed) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (pty-spawner, output-parser, permission-detector)
- **US2 (Phase 4)**: Depends on US1 (interactive runner must exist to add permission handling)
- **US3 (Phase 5)**: Depends on US1 (needs interactive runner output to build summaries)
- **US4 (Phase 6)**: Depends on US1 (needs interactive runner for resume)
- **Polish (Phase 7)**: Depends on all user stories

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no dependency on other stories
- **US2 (P1)**: After US1 — extends interactive runner with permission handling
- **US3 (P2)**: After US1 — extends interactive runner with summary extraction
- **US4 (P3)**: After US1 — extends session manager resume to use interactive runner

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Low-level modules before orchestration
- Core logic before integration wiring
- Story complete before moving to next priority

### Parallel Opportunities

- T002 + T003 can run in parallel (different type additions)
- T004 + T005 can run in parallel (independent file removals)
- T009 + T010 + T011 can run in parallel (independent test files)
- T012 + T013 + T014 can run in parallel (independent new modules)
- T016 + T017 can run in parallel (different test files)
- T025 + T026 can run in parallel (different test files)
- T037 + T038 + T039 + T040 can run in parallel (independent cleanup)

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Write all foundational tests together:
Task T009: "Unit tests for PTY spawner in tests/unit/cursor-agent/pty-spawner.test.ts"
Task T010: "Unit tests for ANSI output parser in tests/unit/cursor-agent/pty-output-parser.test.ts"
Task T011: "Unit tests for PTY permission detector in tests/unit/cursor-agent/pty-permission-detector.test.ts"

# Implement all foundational modules together:
Task T012: "PTY spawner in packages/cursor-agent/src/pty-spawner.ts"
Task T013: "ANSI output parser in packages/cursor-agent/src/pty-output-parser.ts"
Task T014: "PTY permission detector in packages/cursor-agent/src/pty-permission-detector.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (node-pty, types, remove tmux)
2. Complete Phase 2: Foundational (3 PTY modules)
3. Complete Phase 3: User Story 1 (real-time progress)
4. **STOP and VALIDATE**: Gateway starts, task delegation shows progress in Telegram
5. Commit and deploy

### Incremental Delivery

1. Setup + Foundational → PTY infrastructure ready
2. Add US1 → Real-time progress works → Commit (MVP!)
3. Add US2 → Permission prompts work → Commit
4. Add US3 → Clean summaries work → Commit
5. Add US4 → Session resume works → Commit
6. Polish → Cleanup, docs, coverage → Final commit

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each phase or logical group
- Stop at any checkpoint to validate independently
- Files affected: 15 new/modified source files, 12 test files, 6 files removed
