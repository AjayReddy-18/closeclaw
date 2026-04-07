# Scheduled Automation

CloseClaw supports background task scheduling. Tasks run in the same
process as the gateway and deliver results to the user's chat.

## Concepts

### Heartbeat

A periodic check-in that reads `~/.closeclaw/HEARTBEAT.md` and sends its
contents to the AI agent. If the agent responds with `HEARTBEAT_OK`, the
response is suppressed (nothing is sent to the user). Any other response
is delivered to the last active sender.

Configure the heartbeat interval, active hours, and delivery target with:

```bash
closeclaw heartbeat configure
closeclaw heartbeat status
```

The `HEARTBEAT.md` file is a free-form checklist. Example:

```markdown
# Heartbeat checklist
- [ ] Check open Jira issues
- [ ] Verify CI pipeline status
- [ ] Report any failures
```

### Scheduled Tasks

Tasks are AI prompts that execute on a schedule. Three schedule types
are supported:

| Type   | Example           | Description                     |
| ------ | ----------------- | ------------------------------- |
| `at`   | `30m`             | One-shot: runs once after delay |
| `every`| `2h`              | Recurring: runs at an interval  |
| `cron` | `0 9 * * *`       | Recurring: cron expression      |

Duration values use a compact format: `30s`, `5m`, `2h`, `1d`.

### AI-Initiated Scheduling

When the `schedule_task` tool is enabled, the AI agent can create tasks
during a conversation. The agent evaluates whether a scheduled task is
genuinely useful before creating one.

## Architecture

```
User chat ──> MessageProcessor ──> AI response
                  ▲
Heartbeat ────────┘
TaskScheduler ────┘
                  │
                  ▼
              BotAdapter ──> User chat
```

Tasks are persisted to `~/.closeclaw/cron/tasks.json` using atomic
file writes. The `TaskScheduler` manages Node.js timers and a
serialized execution queue to prevent concurrent AI calls.

### Execution Flow

1. A timer fires for a scheduled task.
2. The task is placed in the execution queue.
3. The queue processes tasks one at a time via `TaskExecutor`.
4. The executor invokes `MessageProcessor.processMessage`.
5. The result is recorded as a `TaskRun` and delivered to the user.
6. For one-shot tasks, the status is set to `completed`.
7. For recurring tasks, the next run is computed and a new timer is set.

### Failure Handling

Recurring tasks have a `maxRetries` limit (default: 3). If a task
fails on every attempt and `runCount >= maxRetries`, the status is
set to `failed` and no further executions are scheduled.

## CLI Commands

See [CLI Reference](./cli-reference.md) for full details:

- `closeclaw cron list` — List all tasks
- `closeclaw cron add` — Create a task
- `closeclaw cron remove <id>` — Delete a task
- `closeclaw cron runs <id>` — View run history
- `closeclaw heartbeat configure` — Set up heartbeat
- `closeclaw heartbeat status` — View heartbeat settings

## Data Storage

All scheduled task data lives in `~/.closeclaw/cron/tasks.json`:

```json
{
  "version": "1.0.0",
  "tasks": [
    {
      "id": "abc12345",
      "name": "Daily standup",
      "prompt": "summarize open issues",
      "scheduleType": "cron",
      "scheduleValue": "0 9 * * *",
      "status": "active",
      "runCount": 5,
      "maxRetries": 3,
      "targetPlatform": "telegram",
      "targetSenderId": "42",
      "createdAt": "2026-04-01T09:00:00.000Z"
    }
  ],
  "runs": [
    {
      "taskId": "abc12345",
      "ranAt": "2026-04-05T09:00:01.000Z",
      "outcome": "success",
      "response": "3 open issues, CI green",
      "durationMs": 2400,
      "delivered": true
    }
  ]
}
```

Run history is capped at 50 entries per task.
