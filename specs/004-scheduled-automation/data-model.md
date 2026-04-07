# Data Model: Scheduled Automation

## Entities

### ScheduledTask

Represents a single scheduled job, whether one-shot or recurring.

| Field          | Type                                            | Description                                                           |
| -------------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| id             | string                                          | Unique identifier (UUID v4)                                           |
| name           | string                                          | Human-readable task name                                              |
| prompt         | string                                          | The message/instruction for the AI to execute                         |
| scheduleType   | "at" \| "every" \| "cron"                       | How the task is scheduled                                             |
| scheduleValue  | string                                          | ISO 8601 timestamp, duration string ("30m", "2h"), or cron expression |
| timezone       | string \| undefined                             | IANA timezone for cron expressions (defaults to host TZ)              |
| targetPlatform | string                                          | Bot platform for result delivery ("telegram" \| "discord")            |
| targetSenderId | string                                          | Sender ID for result delivery                                         |
| status         | "active" \| "paused" \| "completed" \| "failed" | Current task state                                                    |
| createdAt      | string                                          | ISO 8601 creation timestamp                                           |
| nextRunAt      | string \| undefined                             | ISO 8601 next scheduled execution time                                |
| lastRunAt      | string \| undefined                             | ISO 8601 last execution time                                          |
| runCount       | number                                          | Total number of executions                                            |
| maxRetries     | number                                          | Maximum retry attempts for failed runs (default: 3)                   |

### TaskRun

A single execution record for a scheduled task.

| Field      | Type                   | Description                                  |
| ---------- | ---------------------- | -------------------------------------------- |
| taskId     | string                 | Reference to parent ScheduledTask            |
| ranAt      | string                 | ISO 8601 execution timestamp                 |
| outcome    | "success" \| "failure" | Execution result                             |
| response   | string \| undefined    | AI response text (on success)                |
| error      | string \| undefined    | Error message (on failure)                   |
| durationMs | number                 | Execution duration in milliseconds           |
| delivered  | boolean                | Whether the result was delivered to the user |

### HeartbeatConfig

Configuration for periodic heartbeat check-ins. Stored as part of the main `~/.closeclaw/config.json`.

| Field       | Type                                        | Description                                             |
| ----------- | ------------------------------------------- | ------------------------------------------------------- |
| enabled     | boolean                                     | Whether heartbeat is active                             |
| every       | string                                      | Interval duration string ("30m", "1h")                  |
| activeHours | { start: string, end: string } \| undefined | Time window for heartbeat (HH:MM format)                |
| timezone    | string \| undefined                         | IANA timezone for active hours                          |
| target      | "last" \| "none"                            | Delivery target ("last" = last sender, "none" = silent) |

### TaskStore (file structure)

Persisted at `~/.closeclaw/cron/tasks.json`:

```json
{
  "version": "1.0.0",
  "tasks": [
    {
      "id": "uuid-here",
      "name": "Morning brief",
      "prompt": "Summarize overnight updates",
      "scheduleType": "cron",
      "scheduleValue": "0 9 * * *",
      "timezone": "America/New_York",
      "targetPlatform": "telegram",
      "targetSenderId": "12345",
      "status": "active",
      "createdAt": "2026-04-05T10:00:00Z",
      "nextRunAt": "2026-04-06T09:00:00-04:00",
      "lastRunAt": null,
      "runCount": 0,
      "maxRetries": 3
    }
  ],
  "runs": [
    {
      "taskId": "uuid-here",
      "ranAt": "2026-04-06T09:00:02Z",
      "outcome": "success",
      "response": "No urgent updates overnight.",
      "durationMs": 3200,
      "delivered": true
    }
  ]
}
```

## State Transitions

### ScheduledTask Lifecycle

```
             ┌──────────┐
             │  active   │◄──── created via CLI or chat tool
             └────┬─────┘
                  │
          ┌───────┼────────┐
          │       │        │
          ▼       ▼        ▼
     [executes] [paused] [removed]
          │       │
          ▼       │
    ┌─────────┐   │
    │ success  │   │
    └────┬────┘   │
         │        │
    ┌────┴────┐   │
    │one-shot?│   │
    └────┬────┘   │
    yes  │  no    │
    ▼    ▼        │
completed active◄─┘
         │
    [max retries exceeded]
         │
         ▼
      failed
```

- **active**: Task is scheduled and will fire at `nextRunAt`
- **paused**: User has paused the task; timer is cleared
- **completed**: One-shot task finished successfully; auto-removed
- **failed**: Permanent failure after max retries; user notified

## Relationships

- Each `ScheduledTask` has zero or more `TaskRun` records
- `HeartbeatConfig` is stored in the top-level `Configuration` alongside `AgentConfig`
- `TaskStore` is independent of `ConversationStore` (separate file, separate directory)
- Task execution reuses the same `AgentConfig` and AI model as the main conversation
- Delivery uses the same `BotAdapter` instances as the main conversation
