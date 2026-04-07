# Implementation Plan: Scheduled Automation

**Branch**: `004-scheduled-automation` | **Date**: 2026-04-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-scheduled-automation/spec.md`

## Summary

Add heartbeat periodic check-ins and scheduled task execution (one-shot and recurring) to the CloseClaw gateway. Tasks run in the background without blocking the user's active conversation. Results are delivered to the user's chat. A `schedule_task` AI tool enables chat-driven scheduling with built-in judgment. CLI commands (`closeclaw cron *`, `closeclaw heartbeat *`) provide task management and heartbeat configuration.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Existing monorepo packages + `cron-parser` (cron expression parsing), `crypto.randomUUID` (task IDs)
**Storage**: JSON file at `~/.closeclaw/cron/tasks.json` (atomic writes via tmp+rename)
**Testing**: Vitest (unit, integration, contract) -- 90% coverage threshold
**Target Platform**: Node.js 22 LTS, macOS/Linux
**Project Type**: CLI tool + long-running gateway
**Performance Goals**: Task fires within 10 seconds of scheduled time; background execution does not increase conversation response time by >5%
**Constraints**: Serialized task execution (one at a time); no external job queue dependencies
**Scale/Scope**: Dozens of tasks per user (single-process, single-user)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                 | Status | Notes                                                                                     |
| ------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| I. TDD                    | PASS   | All new code via Red-Green-Refactor; timer-based tests use `vi.useFakeTimers()`           |
| II. Clean Code            | PASS   | Functions ≤ 20 lines, files ≤ 200 lines, no comments, descriptive names                   |
| III. Design Principles    | PASS   | DI for store/executor/scheduler; composition over inheritance; KISS timer-based scheduler |
| IV. Atomic Commits        | PASS   | Each module committed independently with passing tests; rebuild dist/ before commit       |
| V. Automation-First       | PASS   | Core feature IS automation; idempotent retries, structured logging                        |
| VI. Modular Architecture  | PASS   | New `scheduler` package or module within `ai-agent`; explicit interfaces                  |
| VII. Living Documentation | PASS   | `docs/scheduled-automation.md` updated with feature delivery                              |

**Decision on package structure**: Add scheduler code as a new module within the existing `ai-agent` package rather than creating a new package. Rationale: the scheduler needs direct access to `invokeModel`, `ConversationStore`, and `PreferenceStore` -- all internal to `ai-agent`. Creating a separate package would require exporting internals or duplicating code. The `ai-agent` package is currently ~15 source files; adding ~8 more keeps it well within manageable bounds.

## Project Structure

### Documentation (this feature)

```text
specs/004-scheduled-automation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── scheduler-interfaces.ts
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/ai-agent/src/
├── scheduler/
│   ├── task-types.ts           # ScheduledTask, TaskRun, HeartbeatConfig types
│   ├── task-store.ts           # Persistent task store (load/save/add/remove)
│   ├── task-executor.ts        # Executes a single task via AI model
│   ├── task-scheduler.ts       # Timer management (schedule/unschedule/run)
│   ├── heartbeat-runner.ts     # Heartbeat loop with active hours & HEARTBEAT_OK
│   ├── cron-utils.ts           # Cron expression parsing + next-run computation
│   └── duration-parser.ts      # Parse "30m", "2h", "1d" duration strings
├── tools/
│   └── schedule-task-tool.ts   # AI tool for chat-driven task creation
├── (existing files unchanged)

packages/shared-types/src/
├── heartbeat-config.ts         # HeartbeatConfig type + validator
├── (existing files unchanged)

packages/cli/src/commands/
├── cron-list.ts                # closeclaw cron list
├── cron-add.ts                 # closeclaw cron add
├── cron-remove.ts              # closeclaw cron remove
├── cron-run.ts                 # closeclaw cron run <id>
├── cron-runs.ts                # closeclaw cron runs <id>
├── heartbeat-configure.ts      # closeclaw heartbeat configure
├── heartbeat-status.ts         # closeclaw heartbeat status
├── (existing files unchanged)

packages/gateway/src/
├── (gateway-server.ts modified to accept scheduler + heartbeat)

tests/
├── unit/ai-agent/scheduler/
│   ├── task-store.test.ts
│   ├── task-executor.test.ts
│   ├── task-scheduler.test.ts
│   ├── heartbeat-runner.test.ts
│   ├── cron-utils.test.ts
│   └── duration-parser.test.ts
├── unit/ai-agent/tools/
│   └── schedule-task-tool.test.ts
├── unit/cli/
│   ├── cron-list.test.ts
│   ├── cron-add.test.ts
│   ├── cron-remove.test.ts
│   ├── cron-run.test.ts
│   ├── heartbeat-configure.test.ts
│   └── heartbeat-status.test.ts
├── integration/
│   └── scheduler-flow.test.ts
└── contract/
    └── task-store-schema.test.ts

docs/
├── scheduled-automation.md     # User-facing feature documentation
```

**Structure Decision**: Scheduler code lives inside `packages/ai-agent/src/scheduler/` as a sub-module. CLI commands in `packages/cli/src/commands/`. Shared types for `HeartbeatConfig` in `packages/shared-types/`. This follows the existing monorepo pattern where domain logic is in `ai-agent`, UI is in `cli`, and shared types bridge them.

## Design Decisions

### D1: Timer Architecture

The scheduler uses `setTimeout` for one-shot and first-occurrence scheduling, recalculating the next timer after each execution for recurring tasks. This avoids long-running `setInterval` timers that drift over time. Each task gets one active timer at a time, stored in a `Map<string, NodeJS.Timeout>`.

### D2: Heartbeat as a Special-Case Task

Heartbeat is NOT stored in the task store. It's a dedicated loop managed by `HeartbeatRunner` with its own interval, active hours check, and `HEARTBEAT.md` file reading. This separation keeps heartbeat simple and avoids polluting the task list with an entry the user didn't create.

### D3: Task Execution Serialization

A global execution queue (similar to `enqueueForSender` in the gateway) ensures only one scheduled task runs at a time. The queue key is `"scheduler"` (global, not per-sender). This prevents concurrent AI API calls from multiple tasks firing simultaneously.

### D4: Chat-Driven Scheduling via AI Tool

A `schedule_task` tool is added to the AI's tool set. The tool description instructs the AI to only schedule tasks that genuinely benefit from delayed or periodic execution. The tool accepts: `name`, `prompt`, `scheduleType`, `scheduleValue`, and `reason` (justification). The AI can decline scheduling by simply responding with text instead of calling the tool.

### D5: Delivery Mechanism

Task results are delivered by calling `adapter.sendMessage(targetSenderId, response)` on the adapter matching `targetPlatform`. The adapter references are passed to the scheduler at gateway startup (same instances used for normal conversation). If delivery fails, the result is stored in the `TaskRun` record with `delivered: false`.

### D6: Startup Reconciliation

On gateway start, the scheduler loads all active tasks from disk, computes `nextRunAt` for each, and schedules timers. One-shot tasks with `nextRunAt` in the past fire immediately. Recurring tasks with missed windows skip to the next future occurrence.

## Implementation Phases

### Phase 1: Core Types & Task Store (foundation)

1. Add `HeartbeatConfig` type + validator to `shared-types`
2. Add `Configuration.heartbeat` optional field
3. Create `scheduler/task-types.ts` with all scheduler types
4. Create `scheduler/duration-parser.ts` (parse "30m", "2h" strings)
5. Create `scheduler/task-store.ts` (CRUD, atomic persistence)
6. Tests for all of the above

### Phase 2: Cron Parsing & Task Scheduling Engine

1. Add `cron-parser` dependency
2. Create `scheduler/cron-utils.ts` (parse cron, compute next run)
3. Create `scheduler/task-executor.ts` (run a task via AI model)
4. Create `scheduler/task-scheduler.ts` (timer management, execution queue)
5. Tests for all of the above

### Phase 3: Heartbeat Runner

1. Create `scheduler/heartbeat-runner.ts` (interval loop, HEARTBEAT.md reading, active hours, HEARTBEAT_OK suppression)
2. Tests with fake timers

### Phase 4: AI Tool for Chat-Driven Scheduling

1. Create `tools/schedule-task-tool.ts` (Vercel AI SDK tool definition)
2. Wire tool into `tool-executor.ts` when scheduling is enabled
3. Tests for tool creation and validation logic

### Phase 5: Gateway Integration

1. Modify `gateway-start.ts` to initialize scheduler + heartbeat runner
2. Pass adapter references to scheduler for delivery
3. Wire startup reconciliation (load tasks, schedule timers)
4. Wire shutdown cleanup (stop scheduler, stop heartbeat)
5. Tests for gateway lifecycle with scheduler

### Phase 6: CLI Commands

1. `closeclaw cron add` (interactive + flags)
2. `closeclaw cron list` (table output)
3. `closeclaw cron remove <id>`
4. `closeclaw cron run <id>` (force execute)
5. `closeclaw cron runs <id>` (view history)
6. `closeclaw heartbeat configure` (interactive)
7. `closeclaw heartbeat status`
8. Register all commands in `cli.ts`
9. Tests for each command

### Phase 7: Documentation & Polish

1. Create `docs/scheduled-automation.md`
2. Update `docs/cli-reference.md` with new commands
3. Update `docs/getting-started.md` with scheduler mention
4. Final format, lint, build, coverage check

## Complexity Tracking

No constitution violations to justify. All design choices follow KISS and YAGNI. The scheduler is a simple timer + JSON file, not an enterprise job queue.
