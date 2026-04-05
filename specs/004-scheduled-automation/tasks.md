# Tasks: Scheduled Automation

**Input**: Design documents from `/specs/004-scheduled-automation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDD is mandated by the constitution. Tests are written first (Red), then implementation (Green), then refactor.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Add new dependency and create shared type foundations

- [x] T001 Add `cron-parser` dependency to packages/ai-agent/package.json
- [x] T002 [P] Create `HeartbeatConfig` type and validator in packages/shared-types/src/heartbeat-config.ts
- [x] T003 [P] Add `heartbeat?: HeartbeatConfig` field to `Configuration` interface in packages/shared-types/src/configuration.ts
- [x] T004 [P] Export `HeartbeatConfig` and validator from packages/shared-types/src/index.ts
- [x] T005 [P] Write unit tests for `HeartbeatConfig` validator in tests/unit/shared-types/heartbeat-config.test.ts

**Checkpoint**: Shared types are ready. Build passes. Tests pass.

---

## Phase 2: Foundational (Core Scheduler Infrastructure)

**Purpose**: Task types, duration parser, cron utils, and task store that ALL user stories depend on

- [x] T006 Write unit tests for duration parser in tests/unit/ai-agent/scheduler/duration-parser.test.ts
- [x] T007 Implement duration parser ("30m", "2h", "1d" to milliseconds) in packages/ai-agent/src/scheduler/duration-parser.ts
- [x] T008 [P] Write unit tests for cron utils in tests/unit/ai-agent/scheduler/cron-utils.test.ts
- [x] T009 [P] Implement cron expression parsing and next-run computation in packages/ai-agent/src/scheduler/cron-utils.ts
- [x] T010 Create scheduler type definitions (ScheduledTask, TaskRun, TaskStoreData) in packages/ai-agent/src/scheduler/task-types.ts
- [x] T011 Write unit tests for task store in tests/unit/ai-agent/scheduler/task-store.test.ts
- [x] T012 Implement persistent task store (load/save/add/remove with atomic writes) in packages/ai-agent/src/scheduler/task-store.ts
- [x] T013 Write contract test for task store JSON schema in tests/contract/task-store-schema.test.ts
- [x] T014 Export scheduler types and store from packages/ai-agent/src/index.ts

**Checkpoint**: Foundation ready. Duration parsing, cron parsing, and task persistence all work. All user story work can begin.

---

## Phase 3: User Story 1 - Heartbeat Periodic Check-in (Priority: P1)

**Goal**: The gateway periodically triggers an AI turn that reads `HEARTBEAT.md`, checks for anything that needs attention, and either alerts the user or stays silent.

**Independent Test**: Configure a heartbeat interval, create a `HEARTBEAT.md` file, and verify the bot sends periodic check-in messages or stays silent when nothing needs attention.

### Tests for User Story 1

- [x] T015 [P] [US1] Write unit tests for heartbeat runner in tests/unit/ai-agent/scheduler/heartbeat-runner.test.ts

### Implementation for User Story 1

- [x] T016 [US1] Implement heartbeat runner (interval loop, HEARTBEAT.md reading, active hours check, HEARTBEAT_OK suppression) in packages/ai-agent/src/scheduler/heartbeat-runner.ts
- [x] T017 [US1] Wire heartbeat runner into gateway startup in packages/cli/src/commands/gateway-start.ts
- [x] T018 [US1] Write integration test for heartbeat lifecycle (start, fire, suppress OK, stop) in tests/integration/scheduler-heartbeat-flow.test.ts

**Checkpoint**: Heartbeat works end-to-end. Gateway starts heartbeat timer, AI reads HEARTBEAT.md, alerts are delivered, HEARTBEAT_OK is suppressed.

---

## Phase 4: User Story 2 - One-shot Scheduled Task (Priority: P1)

**Goal**: Users create a one-shot task (via CLI or chat) scheduled for a future time. The task fires, the AI executes the prompt, and the result is delivered to the user's chat. The task auto-deletes after success.

**Independent Test**: Create a one-shot task via CLI, wait for the scheduled time, and verify the result is delivered.

### Tests for User Story 2

- [x] T019 [P] [US2] Write unit tests for task executor in tests/unit/ai-agent/scheduler/task-executor.test.ts
- [x] T020 [P] [US2] Write unit tests for task scheduler in tests/unit/ai-agent/scheduler/task-scheduler.test.ts

### Implementation for User Story 2

- [x] T021 [US2] Implement task executor (run a single task via AI model, record result) in packages/ai-agent/src/scheduler/task-executor.ts
- [x] T022 [US2] Implement task scheduler (timer management, execution queue, one-shot scheduling, startup reconciliation) in packages/ai-agent/src/scheduler/task-scheduler.ts
- [ ] T023 [US2] Wire task scheduler into gateway startup and shutdown in packages/cli/src/commands/gateway-start.ts
- [ ] T024 [US2] Write integration test for one-shot task lifecycle (create, fire, deliver, auto-remove) in tests/integration/scheduler-oneshot-flow.test.ts

**Checkpoint**: One-shot tasks work. Create via code, schedule fires, AI executes, result delivered, task auto-cleaned.

---

## Phase 5: User Story 3 - Recurring Scheduled Task (Priority: P2)

**Goal**: Users create recurring tasks with fixed intervals or cron expressions. Each run triggers an AI turn and delivers results.

**Independent Test**: Create a recurring task with a short interval, verify it fires multiple times.

### Tests for User Story 3

- [ ] T025 [P] [US3] Write unit tests for recurring scheduling (interval and cron) in tests/unit/ai-agent/scheduler/task-scheduler-recurring.test.ts

### Implementation for User Story 3

- [ ] T026 [US3] Add recurring schedule support (every + cron) to task scheduler in packages/ai-agent/src/scheduler/task-scheduler.ts
- [ ] T027 [US3] Add retry with exponential backoff for failed task runs in packages/ai-agent/src/scheduler/task-executor.ts
- [ ] T028 [US3] Write integration test for recurring task lifecycle (create, fire multiple times, remove) in tests/integration/scheduler-recurring-flow.test.ts

**Checkpoint**: Recurring tasks work. Cron and interval schedules fire correctly. Failed runs retry.

---

## Phase 6: User Story 4 - Task Management via CLI (Priority: P2)

**Goal**: Users manage tasks through CLI commands: list, add, remove, force-run, view history.

**Independent Test**: Create tasks, then use list/remove/run commands and verify correct output.

### Tests for User Story 4

- [ ] T029 [P] [US4] Write unit tests for cron add command in tests/unit/cli/cron-add.test.ts
- [ ] T030 [P] [US4] Write unit tests for cron list command in tests/unit/cli/cron-list.test.ts
- [ ] T031 [P] [US4] Write unit tests for cron remove command in tests/unit/cli/cron-remove.test.ts
- [ ] T032 [P] [US4] Write unit tests for cron run command in tests/unit/cli/cron-run.test.ts
- [ ] T033 [P] [US4] Write unit tests for cron runs (history) command in tests/unit/cli/cron-runs.test.ts

### Implementation for User Story 4

- [ ] T034 [US4] Implement `closeclaw cron add` command (interactive + flags) in packages/cli/src/commands/cron-add.ts
- [ ] T035 [P] [US4] Implement `closeclaw cron list` command (table output) in packages/cli/src/commands/cron-list.ts
- [ ] T036 [P] [US4] Implement `closeclaw cron remove` command in packages/cli/src/commands/cron-remove.ts
- [ ] T037 [P] [US4] Implement `closeclaw cron run` command (force execute) in packages/cli/src/commands/cron-run.ts
- [ ] T038 [P] [US4] Implement `closeclaw cron runs` command (view history) in packages/cli/src/commands/cron-runs.ts
- [ ] T039 [US4] Register all cron subcommands in packages/cli/src/cli.ts

**Checkpoint**: All cron CLI commands work. Users can add, list, remove, force-run tasks, and view run history.

---

## Phase 7: User Story 5 - Smart Task Validation via AI Tool (Priority: P2)

**Goal**: A `schedule_task` AI tool enables chat-driven scheduling. The AI uses judgment to only schedule tasks that genuinely benefit from delayed or periodic execution.

**Independent Test**: Ask the bot to schedule legitimate and trivial things, verify it creates tasks for legitimate requests and declines trivial ones.

### Tests for User Story 5

- [ ] T040 [P] [US5] Write unit tests for schedule_task tool in tests/unit/ai-agent/tools/schedule-task-tool.test.ts

### Implementation for User Story 5

- [ ] T041 [US5] Implement `schedule_task` AI tool definition in packages/ai-agent/src/tools/schedule-task-tool.ts
- [ ] T042 [US5] Wire schedule_task tool into tool executor in packages/ai-agent/src/tool-executor.ts
- [ ] T043 [US5] Pass task store reference to tool via message processor in packages/ai-agent/src/message-processor.ts

**Checkpoint**: Users can schedule tasks via chat. AI applies judgment. Tasks created via chat appear in cron list.

---

## Phase 8: User Story 6 - Heartbeat Configuration via CLI (Priority: P3)

**Goal**: Users configure heartbeat settings through CLI commands.

**Independent Test**: Run heartbeat configure command, verify settings are saved to config.

### Tests for User Story 6

- [ ] T044 [P] [US6] Write unit tests for heartbeat configure command in tests/unit/cli/heartbeat-configure.test.ts
- [ ] T045 [P] [US6] Write unit tests for heartbeat status command in tests/unit/cli/heartbeat-status.test.ts

### Implementation for User Story 6

- [ ] T046 [US6] Implement `closeclaw heartbeat configure` command in packages/cli/src/commands/heartbeat-configure.ts
- [ ] T047 [P] [US6] Implement `closeclaw heartbeat status` command in packages/cli/src/commands/heartbeat-status.ts
- [ ] T048 [US6] Register heartbeat subcommands in packages/cli/src/cli.ts

**Checkpoint**: Heartbeat CLI commands work. Users can configure and inspect heartbeat settings.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, final validation, and cross-cutting improvements

- [ ] T049 [P] Create user-facing documentation in docs/scheduled-automation.md
- [ ] T050 [P] Update CLI reference documentation in docs/cli-reference.md with new commands
- [ ] T051 [P] Update getting-started documentation in docs/getting-started.md with scheduler mention
- [ ] T052 Run full suite: `pnpm format && pnpm lint && pnpm format:check && pnpm build && pnpm test:coverage`
- [ ] T053 Verify all tests pass and coverage meets 90% threshold
- [ ] T054 Run quickstart.md validation (manual walkthrough of quickstart steps)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies -- can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion -- BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2
- **User Story 2 (Phase 4)**: Depends on Phase 2
- **User Story 3 (Phase 5)**: Depends on Phase 4 (extends task scheduler)
- **User Story 4 (Phase 6)**: Depends on Phase 2 (task store) + Phase 4 (scheduler for run command)
- **User Story 5 (Phase 7)**: Depends on Phase 4 (task scheduler must exist for tool to create tasks)
- **User Story 6 (Phase 8)**: Depends on Phase 1 (HeartbeatConfig type) + Phase 3 (heartbeat runner)
- **Polish (Phase 9)**: Depends on all previous phases

### User Story Dependencies

- **US1 (Heartbeat)**: Independent after Phase 2
- **US2 (One-shot tasks)**: Independent after Phase 2
- **US3 (Recurring tasks)**: Extends US2 scheduler code
- **US4 (CLI commands)**: Needs task store (Phase 2) + scheduler (Phase 4)
- **US5 (AI tool)**: Needs task scheduler (Phase 4)
- **US6 (Heartbeat CLI)**: Needs heartbeat runner (Phase 3)

### Parallel Opportunities

- Phase 1: T002, T003, T004, T005 can all run in parallel
- Phase 2: T006+T007 parallel with T008+T009; then T010, T011+T012, T013
- Phase 3 and Phase 4 can run in parallel after Phase 2
- Phase 6: All 5 test tasks (T029-T033) can run in parallel; implementation tasks T035-T038 in parallel
- Phase 8: T044+T045 in parallel; T046+T047 in parallel
- Phase 9: T049, T050, T051 in parallel

---

## Parallel Example: Phase 2 (Foundational)

```bash
# These two pairs can run in parallel (different files):
Task: "T006+T007 Duration parser tests + implementation"
Task: "T008+T009 Cron utils tests + implementation"

# Then sequentially:
Task: "T010 Task types"
Task: "T011+T012 Task store tests + implementation"
Task: "T013 Contract test for store schema"
```

## Parallel Example: Phase 6 (CLI Commands)

```bash
# All test tasks in parallel:
Task: "T029 cron add tests"
Task: "T030 cron list tests"
Task: "T031 cron remove tests"
Task: "T032 cron run tests"
Task: "T033 cron runs tests"

# Then implementation tasks (most in parallel):
Task: "T035 cron list implementation"
Task: "T036 cron remove implementation"
Task: "T037 cron run implementation"
Task: "T038 cron runs implementation"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (types + dependency)
2. Complete Phase 2: Foundational (store + parsers)
3. Complete Phase 3: Heartbeat (US1) -- bot becomes proactive
4. Complete Phase 4: One-shot tasks (US2) -- users can schedule reminders
5. **STOP and VALIDATE**: Test heartbeat and one-shot tasks independently
6. This is a functional MVP: bot checks in periodically + handles timed tasks

### Incremental Delivery

1. Setup + Foundational -> Foundation ready
2. Add Heartbeat (US1) -> Test independently -> Commit (proactive bot!)
3. Add One-shot tasks (US2) -> Test independently -> Commit (scheduling!)
4. Add Recurring tasks (US3) -> Test independently -> Commit (cron!)
5. Add CLI commands (US4) -> Test independently -> Commit (management!)
6. Add AI tool (US5) -> Test independently -> Commit (chat-driven!)
7. Add Heartbeat CLI (US6) -> Test independently -> Commit (config!)
8. Polish + docs -> Final commit

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- TDD: Write tests first, verify they fail, then implement
- Commit after each task or logical group per constitution
- Stop at any checkpoint to validate story independently
- Total tasks: 54
