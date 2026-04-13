# Research: Multi-Agent Orchestration

**Feature**: 010-multi-agent-orchestration
**Date**: 2026-04-13

## R1: How to make the AI decompose requests into parallel subtasks

**Decision**: Use a Vercel AI SDK `tool()` called `parallel_tasks` that the AI calls when it identifies independent subtasks. The tool receives an array of subtask descriptions, and the orchestrator executes them concurrently.

**Rationale**: This leverages the existing tool-calling infrastructure. The AI model already excels at structured output via tool calls. Alternatives like structured output parsing or a separate "planning" model call add complexity without benefit. The tool approach also means single-task requests never hit the orchestration path — the AI simply doesn't call the tool.

**Alternatives considered**:
- **Structured output / JSON mode**: Requires a separate "planning" step before every request, adding latency even for single tasks. Rejected for KISS.
- **System prompt + response parsing**: Fragile, requires regex parsing of AI responses. Rejected for reliability.
- **Two-pass approach** (plan call, then execute call): Doubles API calls and latency. Rejected for performance.

## R2: How to run subtasks concurrently with isolated progress

**Decision**: Each subtask gets its own `LiveMessage` instance (via `createLiveMessage`) and runs in its own `Promise`. All subtask promises are collected with `Promise.allSettled` to ensure failure isolation.

**Rationale**: `LiveMessage` is already per-instance and stateless. Creating N instances for N subtasks requires no changes to the `LiveMessage` implementation. `Promise.allSettled` (vs `Promise.all`) guarantees that one failure doesn't cancel siblings — exactly the isolation behavior specified in FR-004.

**Alternatives considered**:
- **Worker threads**: Overkill for I/O-bound tasks (API calls, MCP tools). Node.js event loop handles concurrent I/O natively. Rejected for KISS.
- **Shared LiveMessage with multiplexing**: Would require complex state management to track which subtask owns which section of the message. Rejected for complexity.

## R3: How to handle simultaneous approval requests

**Decision**: Implement a per-sender approval queue in the orchestrator. When a subtask needs approval, it enqueues its request. The queue processes one approval at a time — sends the prompt to the user, waits for response, then processes the next. Non-approval subtasks continue unblocked.

**Rationale**: The current `pendingDecisions` map is keyed by `senderId` only. With parallel subtasks, two approvals from the same sender would collide. The queue ensures sequential delivery while keeping the existing resolution mechanism (callback buttons or text replies) intact.

**Implementation**: Add a `taskId` dimension to the approval handler. The queue holds `{ taskId, prompt, resolve }` entries. Only the head of the queue has its prompt sent to the user. When resolved, the next entry's prompt is sent.

**Alternatives considered**:
- **Compound key (`senderId:taskId`)**: Would show multiple approval prompts simultaneously, confusing the user. Rejected per clarification decision.
- **Auto-deny during parallel**: Too restrictive — Cursor delegation tasks often need approval. Rejected for usability.

## R4: How subtask runners invoke the AI

**Decision**: Each subtask runner calls `processMessage` independently with a subtask-specific prompt. The subtask's `onIntermediateResponse` callback updates its own `LiveMessage`.

**Rationale**: `processMessage` is already the entry point for AI invocation. Each call gets its own conversation context (or shares the user's existing conversation, scoped by the subtask prompt). This reuses the entire existing AI pipeline — tool calling, MCP, Cursor delegation, continuation loop — without modification.

**Key detail**: Subtask prompts are synthetic internal messages (not real user messages). The conversation store should not persist them as part of the user's conversation history. The orchestrator manages this by using a scoped conversation key or by not persisting subtask interactions.

**Alternatives considered**:
- **Direct `generateText` calls**: Would bypass conversation store, preference injection, system prompt building. Rejected for DRY.
- **Custom lightweight agent**: Would duplicate much of `message-processor.ts`. Rejected for maintainability.

## R5: Telegram rate limits with concurrent message edits

**Decision**: Acceptable within design constraints. With max 5 concurrent subtasks, each throttled at 2-second intervals (existing `LiveMessage` throttle), the worst case is ~2.5 edits/second — well within Telegram's ~30 req/s per bot limit.

**Rationale**: 5 subtasks × 1 edit/2s = 2.5 edits/s. Adding sends, typing indicators, and approval messages, peak is ~5-8 req/s. The existing `LiveMessage` throttle is the primary rate-limiting mechanism and requires no changes.

**Alternatives considered**:
- **Global rate limiter across all LiveMessages**: Unnecessary given the math. Would add complexity. Rejected for YAGNI.
- **Reduce max concurrency to 3**: Overly conservative. 5 is safe and covers most real use cases.

## R6: How single-task requests bypass orchestration

**Decision**: If the AI does not call the `parallel_tasks` tool, the request flows through the existing single-agent path unchanged. The orchestration path is only activated when the AI explicitly invokes the tool.

**Rationale**: This is the simplest possible approach — zero changes to the existing path. The AI's tool-calling decision is the natural gatekeeping mechanism. The system prompt guides the AI on when to parallelize (2+ independent tasks) and when not to (single task, dependent tasks).

## R7: Subtask conversation isolation

**Decision**: Subtask prompts do not persist into the user's main conversation. The orchestrator saves only the final summary as the assistant's response in the conversation history.

**Rationale**: If all subtask interactions were persisted, the conversation history would be polluted with synthetic internal messages, confusing future AI context. The user's conversation should show: their original request → the combined summary response.
