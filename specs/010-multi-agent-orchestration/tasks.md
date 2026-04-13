# Tasks: Multi-Agent Orchestration

**Input**: Design documents from `/specs/010-multi-agent-orchestration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDD approach — test tasks included per constitution requirement (Red-Green-Refactor).

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Initialize the `@closeclaw/orchestrator` package and shared types

- [x] T001 Create packages/orchestrator/ with package.json, tsconfig.json, and pnpm workspace entry
- [x] T002 [P] Define orchestration types (SubtaskPlan, SubtaskResult, OrchestrationSession, OrchestrationDeps, SubtaskRunnerDeps) in packages/orchestrator/src/types.ts
- [x] T003 [P] Create packages/orchestrator/src/index.ts with public exports

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core building blocks that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Write unit tests for subtask-runner in tests/unit/orchestrator/subtask-runner.test.ts (test: runs processMessage with subtask prompt, updates LiveMessage, returns SubtaskResult with fulfilled/rejected status)
- [x] T005 Implement createSubtaskRunner in packages/orchestrator/src/subtask-runner.ts (creates a thunk that runs a single subtask with its own LiveMessage, calls processMessage, catches errors, returns SubtaskResult)
- [x] T006 [P] Write unit tests for summary-builder in tests/unit/orchestrator/summary-builder.test.ts (test: formats all-success, mixed, all-failure results into readable summary)
- [x] T007 [P] Implement buildOrchestrationSummary in packages/orchestrator/src/summary-builder.ts (aggregates SubtaskResult[] into formatted text with per-subtask status and results)
- [x] T008 Write unit tests for parallel_tasks tool in tests/unit/ai-agent/parallel-tasks-tool.test.ts (test: Zod schema validation, min 2 / max 5 tasks, returns structured plan)
- [x] T009 Implement createParallelTasksTool in packages/ai-agent/src/tools/parallel-tasks-tool.ts (Zod schema: tasks array with label + prompt, min 2 max 5, execute returns the plan array)

**Checkpoint**: Subtask runner, summary builder, and AI tool are independently testable

---

## Phase 3: User Story 1 — Parallel Subtask Execution (Priority: P1) MVP

**Goal**: AI decomposes multi-part requests into subtasks, orchestrator runs them concurrently, delivers combined results faster than sequential.

**Independent Test**: Send a message with 2+ independent tasks, verify concurrent execution and combined result delivery.

### Tests for User Story 1

- [x] T010 Write unit tests for orchestrator in tests/unit/orchestrator/orchestrator.test.ts (test: creates LiveMessage per subtask, runs subtasks via Promise.allSettled, collects results, calls summary builder, delivers summary via new LiveMessage, disposes all LiveMessages)
- [x] T011 [P] [US1] Write integration test in tests/integration/orchestration-flow.test.ts (test: mock processMessage with varying delays, verify wall-clock time is closer to max(delays) than sum(delays), verify summary contains all results)

### Implementation for User Story 1

- [x] T012 [US1] Implement runOrchestration in packages/orchestrator/src/orchestrator.ts (create N LiveMessages, fan-out via Promise.allSettled on createSubtaskRunner thunks, collect results, build summary, send summary via new message, dispose all)
- [x] T013 [US1] Wire parallel_tasks tool into gateway: detect tool result in packages/gateway/src/gateway-agent-handler.ts, delegate to runOrchestration from @closeclaw/orchestrator
- [x] T014 [US1] Register parallel_tasks tool as an extraTool in packages/cli/src/commands/agent-init.ts alongside existing cursor/scheduler/mcp tools
- [x] T015 [US1] Add orchestration guidance to system prompt in packages/ai-agent/src/system-prompt-builder.ts (when to use parallel_tasks: 2+ independent tasks; when NOT: single task, dependent tasks, simple questions)

**Checkpoint**: Multi-part requests execute concurrently, combined summary delivered. Single-task requests unchanged.

---

## Phase 4: User Story 2 — Per-Subtask Live Progress (Priority: P1)

**Goal**: Each parallel subtask shows its own labeled, live-updating message that updates independently.

**Independent Test**: Send a multi-task request, verify each subtask has its own updating message with a label prefix.

### Tests for User Story 2

- [x] T016 [P] [US2] Write unit test for labeled LiveMessage updates in tests/unit/orchestrator/subtask-runner.test.ts (test: update calls include label prefix like "[Fetch Jira] Thinking...", finalize includes label)

### Implementation for User Story 2

- [x] T017 [US2] Add label prefixing to subtask-runner: in packages/orchestrator/src/subtask-runner.ts, prepend subtask label to all live.update() and live.finalize() calls (e.g., "[Fetch Jira] Working...")
- [x] T018 [US2] Ensure initial message per subtask shows label: in packages/orchestrator/src/orchestrator.ts, first live.update() for each subtask uses "[label] Starting..."

**Checkpoint**: Each subtask's progress message is labeled and updates independently.

---

## Phase 5: User Story 3 — Combined Final Summary (Priority: P2)

**Goal**: After all subtasks complete, a consolidated summary message appears below individual results.

**Independent Test**: Run multi-task request, verify summary message appears after all subtasks finish with success/failure indicators.

### Tests for User Story 3

- [x] T019 [P] [US3] Add summary delivery tests in tests/unit/orchestrator/orchestrator.test.ts (test: summary sent as new message after all subtasks finalize, summary contains per-subtask status, mixed success/failure shows both)

### Implementation for User Story 3

- [x] T020 [US3] Enhance summary-builder in packages/orchestrator/src/summary-builder.ts to produce Telegram-friendly formatted output with status indicators per subtask (checkmark for success, cross for failure, truncated results)
- [x] T021 [US3] Deliver summary via adapter.sendMessage (not editMessage) in packages/orchestrator/src/orchestrator.ts after all subtasks settle

**Checkpoint**: Summary message with all subtask outcomes appears below individual results.

---

## Phase 6: User Story 4 — Subtask Error Isolation (Priority: P2)

**Goal**: One subtask failure does not affect other running subtasks. Failed subtask shows error in its own message.

**Independent Test**: Trigger multi-task request where one subtask is designed to fail, verify others complete normally.

### Tests for User Story 4

- [x] T022 [P] [US4] Write error isolation tests in tests/unit/orchestrator/orchestrator.test.ts (test: one processMessage rejects, others resolve, all results collected, summary shows partial success)
- [x] T023 [P] [US4] Write subtask error display test in tests/unit/orchestrator/subtask-runner.test.ts (test: when processMessage throws, live.finalize is called with error text prefixed by label)

### Implementation for User Story 4

- [x] T024 [US4] Ensure subtask-runner catches processMessage errors in packages/orchestrator/src/subtask-runner.ts, calls live.finalize with formatted error message, returns SubtaskResult with status "rejected"
- [x] T025 [US4] Verify Promise.allSettled usage in packages/orchestrator/src/orchestrator.ts handles mixed fulfilled/rejected without short-circuiting

**Checkpoint**: Failed subtasks show error, successful subtasks deliver results, summary reflects both.

---

## Phase 7: User Story 5 — Approval Handling During Parallel Execution (Priority: P3)

**Goal**: Approval prompts from parallel subtasks are queued and shown one at a time. Non-approval subtasks continue unblocked.

**Independent Test**: Run multi-task request where one subtask triggers Cursor approval, verify other subtasks keep running.

### Tests for User Story 5

- [x] T026 [P] [US5] Write unit tests for approval-queue in tests/unit/orchestrator/approval-queue.test.ts (test: two simultaneous enqueue calls, first prompt sent immediately, second waits until first resolves; dispose rejects remaining)
- [x] T027 [P] [US5] Write integration test for approval during orchestration in tests/unit/gateway/orchestrated-handler.test.ts (test: orchestrator wires approval queue, subtask A pauses for approval while B continues)

### Implementation for User Story 5

- [x] T028 [US5] Implement createApprovalQueue in packages/orchestrator/src/approval-queue.ts (FIFO queue, head entry's prompt sent via askFn, resolve triggers next, dispose rejects all pending)
- [x] T029 [US5] Wire approval queue into orchestrator: in packages/orchestrator/src/orchestrator.ts, create approval queue per session, pass queue's enqueue to each subtask runner as its approval mechanism
- [x] T030 [US5] Update subtask-runner in packages/orchestrator/src/subtask-runner.ts to use approval queue's enqueue instead of direct approvalRef.ask, prefix approval prompt with subtask label
- [x] T031 [US5] Update packages/gateway/src/gateway-agent-handler.ts to pass the adapter's approval asker as the base askFn when creating the orchestration's approval queue

**Checkpoint**: Approval prompts shown one at a time, non-approval subtasks unblocked.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, and final validation

- [x] T032 [P] Create docs/multi-agent-orchestration.md with feature usage guide, examples, and configuration details
- [x] T033 [P] Update README.md with multi-agent orchestration feature description
- [x] T034 Update packages/orchestrator/src/index.ts to export all public functions and types
- [x] T035 Run full test suite, verify 90%+ coverage for new packages/orchestrator code
- [x] T036 Run pnpm build, pnpm lint, pnpm format:check — fix any issues
- [x] T037 Verify single-task regression: existing tests pass with no behavior change for non-parallel requests

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — core orchestration
- **US2 (Phase 4)**: Depends on US1 (extends subtask runner with labels)
- **US3 (Phase 5)**: Depends on US1 (extends summary builder and orchestrator)
- **US4 (Phase 6)**: Can run in parallel with US2/US3 (error handling in subtask runner)
- **US5 (Phase 7)**: Depends on US1 (adds approval queue layer)
- **Polish (Phase 8)**: Depends on all user stories

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only — core MVP
- **US2 (P1)**: Depends on US1 — extends subtask runner with label prefixing
- **US3 (P2)**: Depends on US1 — extends summary builder formatting
- **US4 (P2)**: Depends on US1 — can parallelize with US2/US3 (different code paths)
- **US5 (P3)**: Depends on US1 — adds approval queue, touches subtask runner and orchestrator

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Red-Green-Refactor)
- Types/interfaces before implementation
- Core logic before wiring/integration
- Story complete before moving to next priority

### Parallel Opportunities

- T002 and T003 can run in parallel (different files)
- T006/T007 (summary builder) can run in parallel with T004/T005 (subtask runner)
- T008/T009 (parallel_tasks tool) can run in parallel with T006/T007
- T011 can run in parallel with T010 (different test files)
- US4 error isolation (T022-T025) can run in parallel with US2 (T016-T018) and US3 (T019-T021)
- T032 and T033 can run in parallel (different docs files)

---

## Parallel Example: Foundational Phase

```bash
# These can run in parallel (different files):
Task T004: "Unit tests for subtask-runner in tests/unit/orchestrator/subtask-runner.test.ts"
Task T006: "Unit tests for summary-builder in tests/unit/orchestrator/summary-builder.test.ts"
Task T008: "Unit tests for parallel_tasks tool in tests/unit/ai-agent/parallel-tasks-tool.test.ts"

# Then implement in parallel (different files):
Task T005: "Implement createSubtaskRunner in packages/orchestrator/src/subtask-runner.ts"
Task T007: "Implement buildOrchestrationSummary in packages/orchestrator/src/summary-builder.ts"
Task T009: "Implement createParallelTasksTool in packages/ai-agent/src/tools/parallel-tasks-tool.ts"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T009)
3. Complete Phase 3: US1 — Parallel Execution (T010-T015)
4. **STOP and VALIDATE**: Test with real multi-task message via Telegram
5. If working: proceed to US2-US5

### Incremental Delivery

1. Setup + Foundational → Building blocks ready
2. US1 → Core parallel execution works → **MVP deployed**
3. US2 → Per-subtask labels visible → Better UX
4. US3 + US4 (parallel) → Summary + error isolation → Robust
5. US5 → Approval queue → Full feature complete
6. Polish → Docs, cleanup → Merge-ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- `LiveMessage` from `@closeclaw/bot-adapters` is unchanged — already per-instance
- `processMessage` from `@closeclaw/ai-agent` is called per-subtask with isolated prompts
- Subtask conversations are NOT persisted — only the final summary enters conversation history
- Max 5 concurrent subtasks enforced in the `parallel_tasks` tool Zod schema
- Commit after each task or logical group per constitution
