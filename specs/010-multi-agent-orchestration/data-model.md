# Data Model: Multi-Agent Orchestration

**Feature**: 010-multi-agent-orchestration
**Date**: 2026-04-13

## Entities

### SubtaskPlan

Represents a single subtask as decomposed by the AI.

| Field  | Type   | Description                                                                       |
| ------ | ------ | --------------------------------------------------------------------------------- |
| id     | string | Unique identifier (e.g., `subtask-1`, `subtask-2`)                                |
| label  | string | Short human-readable label shown in progress messages (e.g., "Fetch Jira issues") |
| prompt | string | The full prompt text to send to the AI for this subtask                           |

**Lifecycle**: Created by the AI via the `parallel_tasks` tool call → consumed by the orchestrator → discarded after execution.

### SubtaskResult

Represents the outcome of a completed subtask.

| Field    | Type                      | Description                                   |
| -------- | ------------------------- | --------------------------------------------- |
| id       | string                    | Matches the SubtaskPlan id                    |
| label    | string                    | Matches the SubtaskPlan label                 |
| status   | "fulfilled" \| "rejected" | Whether the subtask succeeded or failed       |
| response | string \| undefined       | The AI's final response text (when fulfilled) |
| error    | string \| undefined       | Error description (when rejected)             |

**Lifecycle**: Created by the subtask runner after execution completes → consumed by the summary builder → discarded after summary delivery.

### OrchestrationSession

Represents the full orchestration context for a single user request.

| Field        | Type            | Description                                 |
| ------------ | --------------- | ------------------------------------------- |
| senderId     | string          | The user who initiated the request          |
| platform     | BotPlatform     | Telegram / Discord                          |
| subtasks     | SubtaskPlan[]   | The decomposed subtasks                     |
| results      | SubtaskResult[] | Collected results after all subtasks finish |
| liveMessages | LiveMessage[]   | One LiveMessage per subtask                 |

**Lifecycle**: Created when the `parallel_tasks` tool is invoked → lives for the duration of execution → disposed after summary delivery. Not persisted.

### ApprovalQueueEntry

Represents a pending approval request in the sequential approval queue.

| Field   | Type                            | Description                              |
| ------- | ------------------------------- | ---------------------------------------- |
| taskId  | string                          | The subtask requesting approval          |
| items   | Array<{ command, description }> | The rejected commands needing approval   |
| resolve | function                        | Callback to resolve the approval promise |

**Lifecycle**: Created when a subtask's Cursor delegation encounters rejected commands → consumed when the user responds → removed from queue.

## Relationships

```text
User Request (1) ──creates──> OrchestrationSession (1)
OrchestrationSession (1) ──contains──> SubtaskPlan (1..5)
SubtaskPlan (1) ──produces──> SubtaskResult (1)
SubtaskPlan (1) ──owns──> LiveMessage (1)
OrchestrationSession (1) ──may have──> ApprovalQueueEntry (0..5)
```

## State Transitions

### SubtaskPlan → SubtaskResult

```text
[planned] → [running] → [fulfilled]
                      → [rejected]
```

- **planned → running**: Orchestrator starts execution via `Promise`
- **running → fulfilled**: `processMessage` returns a response string
- **running → rejected**: `processMessage` throws or returns error

### ApprovalQueueEntry

```text
[queued] → [active] → [resolved]
```

- **queued → active**: Previous entry resolved, this entry becomes head of queue
- **active → resolved**: User responds via callback button or text
