# Feature Specification: Multi-Agent Orchestration

**Feature Branch**: `010-multi-agent-orchestration`
**Created**: 2026-04-13
**Status**: Draft
**Input**: User description: "Launch subagents to work in parallel on subtasks, orchestrate progress, and deliver combined results without disturbing user experience."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Parallel Subtask Execution (Priority: P1)

A user sends a complex request that involves multiple independent pieces of work (e.g., "Fetch my Jira issues, check the build status, and review that PR"). The system recognizes that these subtasks are independent, launches them in parallel, and delivers combined results significantly faster than sequential execution.

**Why this priority**: This is the core value proposition — making multi-part tasks faster by running them concurrently rather than one-by-one.

**Independent Test**: Can be fully tested by sending a message with 2+ independent subtasks and verifying they execute concurrently and return a combined result.

**Acceptance Scenarios**:

1. **Given** a user sends a message with 3 independent subtasks, **When** the system processes the message, **Then** all 3 subtasks execute concurrently and results are delivered together.
2. **Given** a user sends a message with 2 subtasks where one completes in 2 seconds and the other in 10 seconds, **When** both complete, **Then** total wall-clock time is closer to 10 seconds than 12 seconds.
3. **Given** a user sends a simple single-task message, **When** the system processes it, **Then** it behaves exactly as before with no orchestration overhead visible to the user.

---

### User Story 2 - Per-Subtask Live Progress (Priority: P1)

While parallel subtasks are running, the user sees live progress for each subtask in separate messages. Each subtask's message updates independently, so the user can track what's happening across all lanes without confusion.

**Why this priority**: Without per-subtask progress, the user has no idea what's happening during a multi-task operation, which is worse than the single-agent experience.

**Independent Test**: Can be tested by sending a multi-task request and verifying that each subtask updates its own message independently.

**Acceptance Scenarios**:

1. **Given** 3 parallel subtasks are running, **When** subtask A finishes first, **Then** subtask A's message shows its final result while B and C continue showing progress.
2. **Given** parallel subtasks are running, **When** the user checks the chat, **Then** each subtask has its own message that is updated independently, not overwriting other subtask messages.
3. **Given** a subtask completes, **When** its final result is delivered, **Then** the progress message is replaced with the final result for that subtask.

---

### User Story 3 - Combined Final Summary (Priority: P2)

After all parallel subtasks complete, the system delivers a combined summary message that aggregates the key outcomes from each subtask, giving the user a single consolidated view.

**Why this priority**: The summary ties everything together. Without it, the user has to scroll through multiple messages to understand the overall outcome.

**Independent Test**: Can be tested by running a multi-task request and verifying a summary message appears after all subtasks finish.

**Acceptance Scenarios**:

1. **Given** all 3 parallel subtasks have completed, **When** the last one finishes, **Then** a consolidated summary message is delivered below all subtask messages.
2. **Given** 2 subtasks succeed and 1 fails, **When** the summary is generated, **Then** it clearly indicates which succeeded and which failed with error details.

---

### User Story 4 - Subtask Error Isolation (Priority: P2)

If one subtask fails, the other subtasks continue running unaffected. The user is informed about the failure without losing results from successful subtasks.

**Why this priority**: Fault tolerance is essential for parallel execution — one bad task should not poison the entire batch.

**Independent Test**: Can be tested by triggering a multi-task request where one subtask is designed to fail, and verifying other subtasks still complete.

**Acceptance Scenarios**:

1. **Given** 3 subtasks are running and subtask B encounters an error, **When** subtask B fails, **Then** subtasks A and C continue executing normally.
2. **Given** a subtask fails, **When** its progress message is updated, **Then** it shows an error message for that specific subtask.
3. **Given** all subtasks finish (some failed, some succeeded), **When** the summary is delivered, **Then** successful results are fully preserved and failures are clearly marked.

---

### User Story 5 - Approval Handling During Parallel Execution (Priority: P3)

When a subtask (e.g., Cursor delegation) needs user approval, only that subtask pauses while others continue. The approval prompt clearly identifies which subtask is asking.

**Why this priority**: Approval handling is a complex edge case but critical for Cursor delegation tasks running in parallel.

**Independent Test**: Can be tested by running a multi-task request where one subtask triggers an approval prompt, and verifying others keep running.

**Acceptance Scenarios**:

1. **Given** subtask A needs approval and subtask B does not, **When** the approval prompt is sent for A, **Then** subtask B continues running without waiting.
2. **Given** an approval prompt is shown, **When** the user reads it, **Then** it clearly identifies which subtask is asking for approval (e.g., "Cursor Agent (Task: Build tests) needs approval").
3. **Given** the user approves subtask A, **When** A resumes, **Then** its progress message starts updating again below the approval prompt.

---

### Edge Cases

- What happens when all subtasks fail? The summary should clearly state nothing succeeded and show individual errors.
- What happens when the AI determines the tasks are dependent (not parallelizable)? The system should fall back to sequential execution.
- What happens when the user sends a new message while parallel subtasks are still running? The new message should be queued and processed after current subtasks complete (existing sender-queue behavior).
- What happens when one subtask takes dramatically longer than others? The summary waits for all subtasks, but per-subtask messages show intermediate status, so the user sees which one is still running.
- What happens when a Telegram rate limit is hit from too many concurrent message edits? The system should gracefully throttle, not crash.
- What if the AI incorrectly splits a single task into subtasks? The system should bias toward fewer, larger subtasks rather than over-splitting.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST allow the AI agent to autonomously decompose a complex request into independent subtasks. The user MAY override the decomposition by explicitly requesting parallel or sequential execution in their message.
- **FR-002**: System MUST execute independent subtasks concurrently rather than sequentially.
- **FR-003**: System MUST create a separate live-updating message for each parallel subtask.
- **FR-004**: System MUST isolate failures — one subtask's failure MUST NOT affect other running subtasks.
- **FR-005**: System MUST deliver a combined summary message after all subtasks complete. Individual subtask result messages MUST remain visible; the summary is sent as a new message below them.
- **FR-006**: System MUST fall back to single-agent sequential execution for requests that cannot be parallelized.
- **FR-007**: System MUST handle approval/permission prompts per-subtask without blocking other subtasks. When multiple subtasks need approval simultaneously, prompts MUST be queued and shown to the user one at a time.
- **FR-008**: System MUST enforce a maximum number of concurrent subtasks to prevent resource exhaustion and Telegram rate limits.
- **FR-009**: System MUST clearly label each subtask's progress message so the user knows which task it belongs to.
- **FR-010**: System MUST preserve the existing single-task user experience when the AI determines parallelism is not needed.
- **FR-011**: System MUST support Cursor delegation tasks as subtasks within the orchestration.

### Key Entities

- **Orchestration Session**: Represents a single user request that has been decomposed into subtasks. Contains references to all subtask runners and the parent live message state.
- **Subtask**: An individual unit of work within an orchestration session. Has its own LiveMessage, progress state, and result. Can be an AI continuation, MCP tool call, or Cursor delegation.
- **Orchestration Plan**: The AI's decision about how to decompose a request — which parts to parallelize, which to run sequentially, and in what order.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Multi-part requests with 3 independent subtasks complete at least 40% faster (wall-clock time) compared to sequential execution.
- **SC-002**: Each parallel subtask shows its own live progress that updates independently within 3 seconds of activity.
- **SC-003**: A subtask failure does not impact the results of other subtasks in 100% of cases.
- **SC-004**: The combined summary is delivered within 2 seconds of the last subtask completing.
- **SC-005**: Simple single-task requests show no visible change in behavior or latency.
- **SC-006**: Test coverage remains at or above 90% for all new orchestration code.

## Assumptions

- The AI model (Claude Sonnet/Opus) is capable of decomposing requests into independent subtasks via tool calling or structured output.
- Telegram's API rate limits allow at least 5 concurrent message edit operations per chat without triggering throttling (current documented limit is ~30 requests/second per bot).
- Subtask decomposition happens before execution starts — the system does not dynamically discover new subtasks mid-execution.
- The maximum practical concurrency is 5 subtasks per user request; beyond this, the chat becomes too noisy.
- Existing LiveMessage, approval-handler, and Cursor delegation infrastructure are reused and extended, not replaced.
- Sequential dependencies between subtasks (e.g., "fetch data, then analyze it") are handled by the AI deciding not to parallelize those parts. The user can override this decision with explicit instructions.

## Clarifications

### Session 2026-04-13

- Q: Who decides task decomposition — AI autonomously, AI with user override, or user confirms plan? → A: AI decides by default, but user can explicitly request parallel or sequential execution in their message.
- Q: How to handle simultaneous approval prompts from multiple parallel subtasks? → A: Queue approvals sequentially — show one at a time, process in order. The paused subtask waits while other non-approval subtasks continue.
- Q: Should individual subtask result messages be cleaned up when the summary arrives? → A: Keep individual results visible; add summary as a new message below. User has both detail and overview.
