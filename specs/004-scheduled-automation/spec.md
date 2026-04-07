# Feature Specification: Scheduled Automation

**Feature Branch**: `004-scheduled-automation`
**Created**: 2026-04-05
**Status**: Draft
**Input**: User description: "The agent should launch sub-agents or background tasks to monitor or do something the user asked for. It shouldn't stop the user's main conversation. This should work in background and when the task is done it should notify the user. The system should use judgment about whether a scheduled task is actually useful before creating one. Include CLI commands to list and manage scheduled tasks, similar to OpenClaw's cron and heartbeat features."

## User Scenarios & Testing

### User Story 1 - Heartbeat Periodic Check-in (Priority: P1)

The user configures a heartbeat interval and creates a `HEARTBEAT.md` checklist file. The gateway periodically triggers an AI turn that reads the checklist, checks for anything that needs attention, and either alerts the user or stays silent. This runs in the background and never blocks the user's ongoing conversation.

**Why this priority**: Heartbeat is the simplest and highest-value automation. It transforms the bot from purely reactive to proactive -- the bot can surface urgent items, remind the user about deadlines, or check external services on a schedule, all without being asked.

**Independent Test**: Can be fully tested by configuring a heartbeat interval, creating a `HEARTBEAT.md` file, and verifying the bot sends periodic check-in messages or stays silent when nothing needs attention.

**Acceptance Scenarios**:

1. **Given** a gateway is running with heartbeat enabled and a `HEARTBEAT.md` file exists, **When** the heartbeat interval elapses, **Then** the AI processes the checklist and delivers any alerts to the user's chat
2. **Given** a heartbeat runs and nothing needs attention, **When** the AI returns an "all clear" signal, **Then** no message is sent to the user
3. **Given** the user is actively chatting with the bot, **When** a heartbeat fires, **Then** the heartbeat does not interrupt or delay the user's conversation
4. **Given** the gateway restarts, **When** heartbeat is enabled in config, **Then** the heartbeat timer resumes automatically

---

### User Story 2 - One-shot Scheduled Task (Priority: P1)

The user asks the bot (via chat or CLI) to do something at a specific time or after a delay. The system creates a one-shot task that runs in the background. When the task completes, the result is delivered back to the user's chat.

**Why this priority**: One-shot tasks are the most common scheduling need ("remind me in 20 minutes", "check my inbox at 5pm", "run this command in 1 hour"). They unlock immediate value.

**Independent Test**: Can be fully tested by creating a one-shot task via CLI, waiting for the scheduled time, and verifying the result is delivered to the user's chat.

**Acceptance Scenarios**:

1. **Given** a user creates a one-shot task scheduled for 20 minutes from now, **When** 20 minutes pass, **Then** the AI executes the task prompt and delivers the result to the user's chat
2. **Given** a one-shot task completes successfully, **When** delivery finishes, **Then** the task is automatically removed from the task list
3. **Given** the gateway restarts before the scheduled time, **When** the gateway comes back up, **Then** the task is still scheduled (persisted to disk)
4. **Given** a one-shot task fails, **When** the error is transient, **Then** the system retries up to a configured limit before notifying the user of failure

---

### User Story 3 - Recurring Scheduled Task (Priority: P2)

The user creates a recurring task via CLI that runs on a fixed interval or cron schedule. Each run triggers an AI turn with a configured prompt, and results are delivered to the user's chat.

**Why this priority**: Recurring tasks enable workflows like daily standup summaries, periodic inbox checks, and scheduled report generation. They build on one-shot tasks with the addition of recurrence.

**Independent Test**: Can be fully tested by creating a recurring task with a short interval, verifying it fires multiple times, and confirming results are delivered each time.

**Acceptance Scenarios**:

1. **Given** a user creates a task with `--every 1h`, **When** each hour passes, **Then** the AI executes the task and delivers results
2. **Given** a user creates a task with a cron expression, **When** the cron schedule matches, **Then** the task fires at the correct times
3. **Given** a recurring task is active, **When** the user removes it via CLI, **Then** it stops firing and is removed from the task list

---

### User Story 4 - Task Management via CLI (Priority: P2)

The user manages scheduled tasks through CLI commands: listing active tasks, viewing run history, manually triggering a task, and removing tasks.

**Why this priority**: Without management commands, users cannot see what's scheduled, debug failures, or clean up stale tasks. Essential for usability.

**Independent Test**: Can be fully tested by creating tasks, then using list/remove/run commands and verifying correct output.

**Acceptance Scenarios**:

1. **Given** several tasks exist, **When** the user runs the list command, **Then** all tasks are displayed with name, schedule, last run time, and status
2. **Given** a task exists, **When** the user runs the remove command with the task ID, **Then** the task is deleted and no longer fires
3. **Given** a task exists, **When** the user runs the force-run command, **Then** the task executes immediately regardless of schedule

---

### User Story 5 - Smart Task Validation (Priority: P2)

When the user asks the bot via chat to schedule something, the AI uses judgment about whether the request actually benefits from scheduling. If the request is trivial, unnecessary, or better handled immediately, the bot responds directly instead of creating a task.

**Why this priority**: Prevents task spam and keeps the scheduling system useful. Without this, users could accidentally create dozens of pointless background tasks.

**Independent Test**: Can be fully tested by asking the bot to schedule trivial things ("schedule a task to tell me hi every minute") and verifying it pushes back instead of blindly creating the task.

**Acceptance Scenarios**:

1. **Given** a user asks "remind me to check my email in 30 minutes", **When** the AI evaluates this, **Then** it creates a scheduled task because this is a legitimate timed reminder
2. **Given** a user asks "schedule a task to say hello every 5 seconds", **When** the AI evaluates this, **Then** it declines and explains this would not be useful
3. **Given** a user asks "what's the weather?", **When** the AI evaluates this, **Then** it answers immediately without scheduling anything

---

### User Story 6 - Heartbeat Configuration via CLI (Priority: P3)

The user configures heartbeat settings through the CLI: enabling/disabling, setting interval, configuring active hours, and editing the heartbeat checklist.

**Why this priority**: While heartbeat can be configured by editing config files directly, a CLI command makes it accessible and discoverable.

**Independent Test**: Can be fully tested by running the heartbeat configure command and verifying settings are saved to config.

**Acceptance Scenarios**:

1. **Given** heartbeat is not configured, **When** the user runs the heartbeat configure command, **Then** they are prompted for interval and active hours, and settings are saved
2. **Given** heartbeat is configured, **When** the user runs the heartbeat status command, **Then** the current configuration and next scheduled run are displayed

---

### Edge Cases

- What happens when a task's scheduled time has already passed by the time the gateway starts? The task fires immediately on startup for one-shot tasks; recurring tasks skip the missed window and wait for the next occurrence
- What happens when two tasks are scheduled for the exact same time? Tasks run sequentially, not in parallel, to avoid overwhelming the AI provider with concurrent requests
- What happens when the AI provider is unavailable during a scheduled task? The system retries with exponential backoff up to a configured limit, then marks the run as failed and notifies the user
- What happens when the user's chat platform is unreachable for result delivery? The result is stored locally and delivery is retried when the platform becomes available
- What happens when heartbeat and a scheduled task fire simultaneously? The scheduled task takes priority; the heartbeat is deferred to the next interval
- What happens when the task list file becomes corrupted? The system detects the corruption, logs a warning, and starts with an empty task list (no silent data loss)

## Requirements

### Functional Requirements

- **FR-001**: System MUST run scheduled tasks in the background without blocking the user's active conversation
- **FR-002**: System MUST persist all scheduled tasks to disk so they survive gateway restarts
- **FR-003**: System MUST support one-shot tasks with absolute timestamps or relative delays
- **FR-004**: System MUST support recurring tasks with fixed intervals and cron expressions
- **FR-005**: System MUST deliver task results to the user's chat when a scheduled task completes
- **FR-006**: System MUST run periodic heartbeat AI turns when heartbeat is enabled
- **FR-007**: System MUST suppress heartbeat delivery when the AI determines nothing needs attention
- **FR-008**: System MUST read a `HEARTBEAT.md` file as context for heartbeat AI turns
- **FR-009**: System MUST provide CLI commands to list, add, remove, and manually run scheduled tasks
- **FR-010**: System MUST provide CLI commands to view heartbeat configuration and status
- **FR-011**: System MUST retry failed task executions with exponential backoff up to a configurable limit
- **FR-012**: System MUST automatically remove one-shot tasks after successful completion
- **FR-013**: System MUST log all task executions with timestamps and outcomes
- **FR-014**: System MUST validate that scheduled tasks serve a legitimate purpose before creating them (AI judgment via tool design)
- **FR-015**: System MUST support timezone-aware scheduling for cron expressions
- **FR-016**: System MUST support active hours configuration for heartbeat (only run during specified time window)
- **FR-017**: System MUST serialize task execution to avoid concurrent AI provider calls from multiple tasks

### Key Entities

- **ScheduledTask**: Represents a scheduled job with a name, schedule (at/every/cron), prompt, execution style, status, and run history
- **HeartbeatConfig**: Configuration for periodic check-ins including interval, active hours, and target delivery channel
- **TaskRun**: A single execution record of a scheduled task with timestamp, outcome (success/failure), and response content
- **TaskStore**: Persistent storage for scheduled tasks, backed by a JSON file at `~/.closeclaw/cron/tasks.json`

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can create a scheduled task and receive the result within 10 seconds of the scheduled time
- **SC-002**: Heartbeat check-ins run at the configured interval with less than 30 seconds drift
- **SC-003**: Scheduled tasks survive gateway restarts with zero data loss
- **SC-004**: Background task execution does not increase active conversation response time by more than 5%
- **SC-005**: Users can list, add, and remove tasks in under 5 seconds each
- **SC-006**: Failed tasks retry automatically and notify the user of permanent failures within 2 minutes
- **SC-007**: Test coverage for all scheduled automation code meets the project's global threshold

## Assumptions

- The gateway process runs continuously (scheduled tasks do not run when the gateway is stopped)
- AI provider API keys are already configured via `closeclaw agent configure`
- At least one bot adapter (Telegram or Discord) is configured and connected for result delivery
- The host system clock is reasonably accurate for scheduling purposes
- Task concurrency is serialized (one task at a time) to avoid hitting AI provider rate limits
- The `HEARTBEAT.md` file is manually created and maintained by the user in `~/.closeclaw/`
- Timezone defaults to the host system timezone when not explicitly specified
- Task persistence uses the same atomic-write pattern established in conversation persistence
