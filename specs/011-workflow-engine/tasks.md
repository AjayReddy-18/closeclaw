# Tasks: Workflow Engine

**Input**: Design documents from `/specs/011-workflow-engine/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included (constitution mandates TDD with near 100% coverage).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `packages/workflow/src/`, `packages/ai-agent/src/`, `packages/gateway/src/`, `packages/cli/src/`
- **Tests**: `tests/unit/workflow/`, `tests/unit/ai-agent/`, `tests/integration/`, `tests/contract/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the `@closeclaw/workflow` package and install dependencies

- [x] T001 Create packages/workflow/ directory with package.json, tsconfig.json, tsdown.config.ts (follow packages/orchestrator/ pattern)
- [x] T002 Add `yaml` npm dependency to packages/workflow/package.json and add `@closeclaw/shared-types` as workspace dependency
- [x] T003 Add `packages/workflow` to pnpm-workspace.yaml and run `pnpm install --no-frozen-lockfile`
- [x] T004 [P] Define all types in packages/workflow/src/types.ts (WorkflowDefinition, StepNode union, Trigger, ExecutionRecord, StepResult, StepOutputContext, resource limit constants)
- [x] T005 [P] Define resource limit constants in packages/workflow/src/resource-limits.ts (MAX_STEPS=20, MAX_PARALLEL=5, MAX_LOOP_ITERATIONS=50, MAX_CONCURRENT_WORKFLOWS=3, DEFAULT_APPROVAL_TIMEOUT_SECONDS=300)
- [x] T006 Create packages/workflow/src/index.ts with all public exports
- [x] T007 Add `@closeclaw/workflow` alias to vitest.config.ts and exclude packages/workflow/src/types.ts from coverage

**Checkpoint**: Package builds, installs, and is recognized by the monorepo

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core runtime modules that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T008 [P] Test workflow-validator in tests/unit/workflow/workflow-validator.test.ts (valid definitions, invalid schemas, step limit enforcement, missing fields)
- [x] T009 [P] Test output-interpolator in tests/unit/workflow/output-interpolator.test.ts (single reference, multiple references, missing references, no-op when no templates)
- [x] T010 [P] Test step-executor in tests/unit/workflow/step-executor.test.ts (successful execution, failure handling, output capture, approval pause flow)
- [x] T011 [P] Test condition-evaluator in tests/unit/workflow/condition-evaluator.test.ts (true result, false result, AI error handling)
- [x] T012 [P] Test execution-recorder in tests/unit/workflow/execution-recorder.test.ts (create record, add step result, finalize with status/duration)
- [x] T013 [P] Test progress-reporter in tests/unit/workflow/progress-reporter.test.ts (step progress format, finalize with summary)
- [x] T014 [P] Test workflow-store in tests/unit/workflow/workflow-store.test.ts (save writes both JSON and YAML, get, list by owner, update, delete, add execution, get executions with limit, one-shot execution records saved to _oneshot/, atomic write)
- [x] T015 Implement workflow-validator in packages/workflow/src/workflow-validator.ts (Zod schema for WorkflowDefinition, recursive StepNode validation, resource limit checks)
- [x] T016 Implement output-interpolator in packages/workflow/src/output-interpolator.ts (resolve `{{stepId.output}}` templates from StepOutputContext)
- [x] T017 Implement step-executor in packages/workflow/src/step-executor.ts (execute single action step via processMessage, capture output, handle errors per onError policy)
- [x] T018 Implement condition-evaluator in packages/workflow/src/condition-evaluator.ts (send condition + context to processMessage, parse boolean result)
- [x] T019 Implement execution-recorder in packages/workflow/src/execution-recorder.ts (create ExecutionRecord, append StepResult, finalize with status/duration/completedAt)
- [x] T020 Implement progress-reporter in packages/workflow/src/progress-reporter.ts (format "[Step N/M: label] Running...", update LiveMessage, finalize with summary)
- [x] T021 Implement workflow-store in packages/workflow/src/workflow-store.ts (save definitions as both JSON and human-readable YAML in ~/.closeclaw/workflows/definitions/, execution history as JSON in history/, one-shot execution records in history/_oneshot/, atomic writes)
- [x] T022 Update packages/workflow/src/index.ts with all new exports

**Checkpoint**: Foundation ready — all core modules tested and passing, user story implementation can begin

---

## Phase 3: User Story 1 — Create and Run a Reusable Workflow via Chat (Priority: P1) MVP

**Goal**: User sends a natural language message, AI creates a workflow definition, user confirms, workflow is saved and executes on its cron trigger

**Independent Test**: Send "Every morning at 9am, check my Jira tickets and summarize", verify workflow is created with cron trigger and steps, confirm it fires on schedule

### Tests for User Story 1

- [x] T023 [P] [US1] Test workflow-runner in tests/unit/workflow/workflow-runner.test.ts (sequential steps, condition branching true/false, output forwarding between steps, step failure with stop policy, step failure with continue policy)
- [x] T024 [P] [US1] Test create-workflow-tool in tests/unit/ai-agent/create-workflow-tool.test.ts (schema validation, signal tool populates WorkflowPlanRef, execute returns definition)
- [x] T025 [P] [US1] Test workflow-scheduler in tests/unit/cli/workflow-scheduler.test.ts (arm cron workflow, disarm workflow, start re-arms all active cron workflows, stop clears timers)
- [x] T026 [P] [US1] Contract test for workflow definition schema in tests/contract/workflow-schema.test.ts (valid YAML examples from contracts/ parse and validate, invalid examples rejected)

### Implementation for User Story 1

- [x] T027 [US1] Implement workflow-runner in packages/workflow/src/workflow-runner.ts (execute WorkflowDefinition: iterate steps, dispatch by type, build StepOutputContext, use step-executor/condition-evaluator/progress-reporter/execution-recorder)
- [x] T028 [US1] Implement create-workflow-tool in packages/ai-agent/src/tools/create-workflow-tool.ts (Zod schema from contracts, signal tool pattern with WorkflowPlanRef, return definition for AI confirmation)
- [x] T029 [US1] Add WORKFLOW_GUIDANCE section to packages/ai-agent/src/system-prompt-builder.ts (SystemPromptParts.hasWorkflows, guidance on when to use create_workflow tool)
- [x] T030 [US1] Implement workflow-scheduler in packages/cli/src/commands/workflow-scheduler.ts (arm/disarm cron workflows using setTimeout pattern from task-scheduler, executor calls workflow-runner)
- [ ] T030a [US1] Implement chat keyword trigger detection in packages/gateway/src/gateway-agent-handler.ts (before AI invocation, check incoming message against active workflows with trigger.type=chat_keyword, if match execute workflow via workflow-runner, FR-005)
- [ ] T030b [P] [US1] Test chat keyword trigger in tests/unit/gateway/gateway-agent-handler-keyword-trigger.test.ts (keyword match triggers workflow, partial match does not, disabled workflow skipped, case-insensitive matching)
- [x] T031 [US1] Implement workflow-setup in packages/cli/src/commands/workflow-setup.ts (factory: create store, scheduler, wire tools, create WorkflowPlanRef)
- [x] T032 [US1] Wire workflow system into packages/cli/src/commands/gateway-start.ts (init workflow store, scheduler, tools into agent, start scheduler on gateway start, stop on shutdown)
- [x] T033 [US1] Wire WorkflowPlanRef detection in packages/gateway/src/gateway-agent-handler.ts (after processMessage, check workflowPlanRef, confirm with user or execute one-shot)
- [x] T034 [US1] Add `@closeclaw/workflow` dependency to packages/cli/package.json
- [x] T035 [P] [US1] Integration test in tests/integration/workflow-execution-flow.test.ts (end-to-end: create definition, run workflow-runner with mock processMessage, verify step execution order, condition branching, output interpolation, execution record)

**Checkpoint**: User Story 1 fully functional — reusable workflows can be created via chat and executed on schedule

---

## Phase 4: User Story 2 — Run a One-Shot Workflow (Priority: P1)

**Goal**: User describes a multi-step task, AI creates a workflow, system executes it immediately without saving

**Independent Test**: Send "Check CI, if failed create Jira ticket", verify steps execute in order and no workflow is persisted

### Tests for User Story 2

- [x] T036 [P] [US2] Test one-shot execution path in tests/unit/gateway/gateway-agent-handler-workflow.test.ts (WorkflowPlanRef with oneShot=true triggers immediate execution, no store.saveWorkflow called, execution record IS saved to history/_oneshot/, results delivered)

### Implementation for User Story 2

- [x] T037 [US2] Extend gateway-agent-handler.ts WorkflowPlanRef handling to detect oneShot flag and execute immediately via workflow-runner without saving definition, but persist execution record to history/_oneshot/ in packages/gateway/src/gateway-agent-handler.ts
- [x] T038 [US2] Extend create-workflow-tool to pass oneShot flag from AI schema in packages/ai-agent/src/tools/create-workflow-tool.ts
- [x] T039 [US2] Update WORKFLOW_GUIDANCE in system-prompt-builder.ts to instruct AI on when to use oneShot vs reusable in packages/ai-agent/src/system-prompt-builder.ts

**Checkpoint**: Both one-shot and reusable workflows work from chat

---

## Phase 5: User Story 3 — Create a Workflow via YAML (Priority: P2)

**Goal**: Power user sends a YAML workflow definition, system validates, confirms, and saves/runs it

**Independent Test**: Send a YAML block with trigger and steps, verify it's parsed, validated, and saved

### Tests for User Story 3

- [x] T040 [P] [US3] Test yaml-parser in tests/unit/workflow/yaml-parser.test.ts (valid YAML parses to WorkflowDefinition, invalid YAML returns parse errors, multi-document YAML, missing fields)

### Implementation for User Story 3

- [x] T041 [US3] Implement yaml-parser in packages/workflow/src/yaml-parser.ts (parse YAML string to raw object, validate with workflow-validator, return WorkflowDefinition or errors)
- [ ] T042 [US3] Add YAML detection logic in gateway-agent-handler.ts — detect YAML blocks in user messages (triple backtick yaml or raw YAML structure), parse and validate, confirm with user in packages/gateway/src/gateway-agent-handler.ts

**Checkpoint**: YAML workflow creation works alongside natural language creation

---

## Phase 6: User Story 4 — Workflow with Human-in-the-Loop Approval (Priority: P2)

**Goal**: Workflows can pause at approval steps, prompt the user, and resume or abort based on response

**Independent Test**: Create a workflow with requiresApproval=true on a step, verify execution pauses and resumes on approval

### Tests for User Story 4

- [x] T043 [P] [US4] Test approval-handler in tests/unit/workflow/approval-handler.test.ts (pause and wait for approval, resume on approve, abort on deny, abort on timeout)

### Implementation for User Story 4

- [x] T044 [US4] Implement approval-handler in packages/workflow/src/approval-handler.ts (send approval prompt via adapter, wait for response with timeout, return decision)
- [ ] T045 [US4] Integrate approval-handler into step-executor — check requiresApproval before executing, call approval-handler, abort if denied/timeout in packages/workflow/src/step-executor.ts
- [ ] T046 [US4] Wire approval callback from gateway into workflow-setup (reuse existing approval button pattern from Telegram/Discord) in packages/cli/src/commands/workflow-setup.ts

**Checkpoint**: Approval pauses work within workflow execution

---

## Phase 7: User Story 5 — Parallel Step Execution (Priority: P2)

**Goal**: Workflows can run multiple branches concurrently and merge results

**Independent Test**: Create a workflow with a parallel block of 3 steps, verify all 3 execute concurrently and results merge

### Tests for User Story 5

- [x] T047 [P] [US5] Test parallel-executor in tests/unit/workflow/parallel-executor.test.ts (concurrent execution, one branch fails but others complete, results merged into StepOutputContext, resource limit enforced)

### Implementation for User Story 5

- [x] T048 [US5] Implement parallel-executor in packages/workflow/src/parallel-executor.ts (Promise.allSettled for branches, collect results, merge into StepOutputContext)
- [x] T049 [US5] Integrate parallel-executor into workflow-runner — dispatch parallel StepNode type to parallel-executor in packages/workflow/src/workflow-runner.ts

**Checkpoint**: Parallel steps execute concurrently within workflows

---

## Phase 8: User Story 6 — Workflow with Loops (Priority: P3)

**Goal**: Workflows can repeat steps with a delay until a condition is met or max iterations reached

**Independent Test**: Create a workflow with a loop that polls a mock service, verify it repeats and exits on condition

### Tests for User Story 6

- [x] T050 [P] [US6] Test loop-executor in tests/unit/workflow/loop-executor.test.ts (exit on condition met, exit on max iterations, delay between iterations, step failure within loop)

### Implementation for User Story 6

- [x] T051 [US6] Implement loop-executor in packages/workflow/src/loop-executor.ts (repeat steps, evaluate untilCondition via condition-evaluator after each iteration, respect delaySeconds and maxIterations)
- [x] T052 [US6] Integrate loop-executor into workflow-runner — dispatch loop StepNode type to loop-executor in packages/workflow/src/workflow-runner.ts

**Checkpoint**: Loop/polling patterns work within workflows

---

## Phase 9: User Story 7 — Manage Saved Workflows (Priority: P3)

**Goal**: Users can list, enable, disable, delete workflows and view execution history via chat or CLI

**Independent Test**: Create workflows, then list/disable/enable/delete them via chat, verify history query works

### Tests for User Story 7

- [x] T053 [P] [US7] Test manage-workflow-tool in tests/unit/ai-agent/manage-workflow-tool.test.ts (list returns workflows, enable/disable toggles status, delete removes workflow, history returns execution records)

### Implementation for User Story 7

- [x] T054 [US7] Implement manage-workflow-tool in packages/ai-agent/src/tools/manage-workflow-tool.ts (Zod schema for manage_workflow and run_workflow actions, delegates to WorkflowStore and WorkflowScheduler)
- [ ] T055 [US7] Wire manage-workflow and run-workflow tools into agent-init.ts extraTools in packages/cli/src/commands/agent-init.ts
- [ ] T056 [US7] Add workflow management guidance to WORKFLOW_GUIDANCE in system-prompt-builder.ts in packages/ai-agent/src/system-prompt-builder.ts

**Checkpoint**: Full workflow lifecycle management via chat

---

## Phase 10: User Story 8 — Webhook-Triggered Workflow (Priority: P3)

**Goal**: External systems can trigger workflows via HTTP POST to a unique webhook URL

**Independent Test**: Create a webhook-triggered workflow, POST to its URL, verify execution starts with payload

### Tests for User Story 8

- [x] T057 [P] [US8] Test webhook route in tests/unit/gateway/webhook-route.test.ts (valid secret triggers execution, invalid secret returns 401, disabled workflow returns 404, payload forwarded to execution)

### Implementation for User Story 8

- [x] T058 [US8] Add POST /webhooks/:workflowId route to packages/gateway/src/gateway-routes.ts (authenticate via Bearer webhook secret, look up workflow from store, execute via workflow-runner)
- [ ] T059 [US8] Generate webhook secret on workflow save (when trigger.type is webhook) in packages/workflow/src/workflow-store.ts
- [ ] T060 [US8] Wire webhook route with workflow store and runner in packages/cli/src/commands/gateway-start.ts

**Checkpoint**: Webhook triggers work for external integrations

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, coverage, build validation

- [ ] T061 [P] Create docs/workflows.md with usage guide, YAML examples, trigger types, management commands, and example workflows
- [ ] T062 [P] Update README.md to add "Workflow Engine" to the features list and add docs/workflows.md to documentation links
- [ ] T063 [P] Update docs/cli-reference.md with workflow-related commands (if CLI commands added)
- [ ] T064 Verify all packages/workflow/src/index.ts exports are complete and correct
- [ ] T065 Run full test suite: `pnpm test && pnpm test:coverage && pnpm lint && pnpm format:check && pnpm build`
- [ ] T066 Fix any coverage gaps to ensure >=90% branch coverage
- [ ] T067 Run quickstart.md validation steps manually
- [ ] T068 Add graceful shutdown handler in packages/cli/src/commands/gateway-start.ts (on SIGINT/SIGTERM, mark any running workflow executions as status=interrupted in their execution records before exiting)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — core engine, MVP
- **US2 (Phase 4)**: Depends on US1 (extends gateway handler and create-workflow tool)
- **US3 (Phase 5)**: Depends on Foundational only — independent of US1/US2
- **US4 (Phase 6)**: Depends on Foundational only — extends step-executor
- **US5 (Phase 7)**: Depends on Foundational only — extends workflow-runner
- **US6 (Phase 8)**: Depends on Foundational + US5 condition-evaluator pattern
- **US7 (Phase 9)**: Depends on US1 (needs workflow store with saved workflows)
- **US8 (Phase 10)**: Depends on Foundational + gateway routes
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: BLOCKS US2, US7. Core engine is the MVP.
- **US2 (P1)**: Depends on US1. Extends the gateway handler.
- **US3 (P2)**: Independent after Foundational. Can run parallel with US1.
- **US4 (P2)**: Independent after Foundational. Can run parallel with US1.
- **US5 (P2)**: Independent after Foundational. Can run parallel with US1.
- **US6 (P3)**: Independent after Foundational, but benefits from US5's condition-evaluator.
- **US7 (P3)**: Depends on US1 (needs stored workflows to manage).
- **US8 (P3)**: Independent after Foundational.

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Core modules before integration wiring
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks T004-T005 marked [P] can run in parallel
- All Foundational test tasks T008-T014 can run in parallel
- All Foundational implementation tasks T015-T021 can run in parallel (different files)
- After Foundational: US3, US4, US5, US8 can all run in parallel with US1
- Within each story: test tasks marked [P] can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# All test files in parallel:
Task T008: "Test workflow-validator"
Task T009: "Test output-interpolator"
Task T010: "Test step-executor"
Task T011: "Test condition-evaluator"
Task T012: "Test execution-recorder"
Task T013: "Test progress-reporter"
Task T014: "Test workflow-store"

# Then all implementations in parallel:
Task T015: "Implement workflow-validator"
Task T016: "Implement output-interpolator"
Task T017: "Implement step-executor"
Task T018: "Implement condition-evaluator"
Task T019: "Implement execution-recorder"
Task T020: "Implement progress-reporter"
Task T021: "Implement workflow-store"
```

## Parallel Example: After Foundational

```bash
# These user stories can start simultaneously:
US1 (Phase 3): Core engine + chat creation + cron trigger + chat keyword trigger
US3 (Phase 5): YAML parser (independent)
US4 (Phase 6): Approval handler (independent)
US5 (Phase 7): Parallel executor (independent)
US8 (Phase 10): Webhook route (independent)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (reusable workflows via chat)
4. Complete Phase 4: User Story 2 (one-shot workflows)
5. **STOP and VALIDATE**: Test both stories independently
6. Deploy/demo — users can create and run workflows from chat

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → Reusable workflows via chat with cron triggers (MVP)
3. US2 → One-shot workflows for ad-hoc tasks
4. US3 → YAML workflow creation for power users
5. US4 → Approval pauses for sensitive operations
6. US5 → Parallel steps for faster workflows
7. US6 → Loop/polling patterns
8. US7 → Workflow management (list, enable, disable, delete)
9. US8 → Webhook triggers for external integrations
10. Polish → Docs, coverage, build validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Constitution: functions <= 20 lines, files <= 200 lines, no comments, 90%+ coverage
- Total new source files: ~14 in packages/workflow/, ~2 in packages/ai-agent/, ~2 in packages/cli/, ~1 route addition in packages/gateway/
