# Multi-Agent Orchestration

CloseClaw can decompose complex user requests into independent subtasks and execute them in parallel, delivering results faster than sequential processing.

## How It Works

When you send a message with multiple independent parts, the AI agent can use the `parallel_tasks` tool to split your request into 2-5 subtasks. Each subtask runs concurrently with its own live-updating progress message.

**Example:**

> "Check my Jira issues and also check the CI build status"

The agent detects two independent tasks:

1. **Fetch Jira** — queries your Jira issues
2. **Check CI** — checks the build pipeline

Both run at the same time. You see separate live-updating messages for each, and a combined summary appears when all are done.

## Per-Subtask Progress

Each subtask gets its own message in the chat, prefixed with a label:

```
[Fetch Jira] Querying issues...
[Check CI] Checking pipeline status...
```

Messages update in real-time as each subtask progresses.

## Summary Message

After all subtasks complete, a summary message appears below the individual results:

```
All 2 tasks completed successfully.

✅ Fetch Jira
Found 5 open issues assigned to you.

✅ Check CI
Build #1234 passed on main branch.
```

If any subtask fails, it shows with a failure indicator:

```
1 of 2 tasks succeeded, 1 failed.

✅ Fetch Jira
Found 5 open issues.

❌ Check CI
Connection timeout after 30s.
```

## Error Isolation

One subtask failing does not affect others. If "Check CI" fails, "Fetch Jira" still completes and delivers its result normally.

## Approval Handling

When subtasks trigger approval prompts (e.g., from Cursor CLI delegation), prompts are queued and shown one at a time. Non-approval subtasks continue running while waiting for user input.

## When Orchestration Is Used

The AI decides when to use parallel execution based on these guidelines:

**Used when:**

- The message contains 2+ clearly independent requests
- Each part can be answered without the other's result
- User explicitly asks for multiple things

**Not used when:**

- Single questions or simple lookups
- Tasks that depend on each other's results
- Fewer than 2 independent parts

## Limits

- **2-5 subtasks** per orchestration (enforced by the tool schema)
- Subtask prompts are self-contained — each includes all context needed
- Subtask conversations are not persisted — only the final summary enters history

## Architecture

The orchestration system is in the `@closeclaw/orchestrator` package:

- `subtask-runner` — executes a single subtask with its own `LiveMessage`
- `orchestrator` — fans out subtasks via `Promise.allSettled`, collects results
- `summary-builder` — formats the combined summary with status indicators
- `approval-queue` — serializes approval prompts from concurrent subtasks
- `parallel_tasks` tool — AI tool that signals the request decomposition
