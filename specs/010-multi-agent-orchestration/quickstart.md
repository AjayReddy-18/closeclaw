# Quickstart: Multi-Agent Orchestration

**Feature**: 010-multi-agent-orchestration

## What it does

When you send a message with multiple independent tasks (e.g., "Fetch my Jira issues, check the build status, and review that PR"), CloseClaw's AI recognizes the independent parts and runs them in parallel. Each subtask shows its own live-updating message, and a combined summary appears when all are done.

## How it works for the user

1. Send a message with 2+ independent tasks
2. See separate progress messages appear — one per subtask
3. Each message updates independently as its subtask progresses
4. If a subtask needs approval (e.g., Cursor delegation), you'll see a button prompt for just that subtask
5. Once all subtasks finish, a combined summary appears below

## How it works internally

1. The AI calls the `parallel_tasks` tool with an array of subtask descriptions
2. The gateway handler detects this tool call result and delegates to the orchestrator
3. The orchestrator creates one `LiveMessage` per subtask and runs them concurrently
4. Each subtask calls `processMessage` independently with its own prompt
5. `Promise.allSettled` collects all results
6. The summary builder aggregates results and delivers via a final `LiveMessage`

## Single-task behavior

If the AI determines the request is a single task (or tasks are dependent), it simply doesn't call the `parallel_tasks` tool. The entire existing flow is unchanged — zero overhead.

## Limits

- Maximum 5 concurrent subtasks per request
- Each subtask gets its own 2-second throttled `LiveMessage`
- Approval prompts are shown one at a time, even if multiple subtasks need approval
- Subtask conversations are not persisted — only the final summary enters conversation history

## Development

```bash
# Run tests
pnpm test

# Build all packages
pnpm build

# Start gateway with orchestration support
pnpm closeclaw gateway start
```

No additional configuration needed. Orchestration is available automatically when the AI agent is active.
