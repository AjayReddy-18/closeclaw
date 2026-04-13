# Contract: Orchestrator API

**Package**: `@closeclaw/orchestrator`

## Public Interfaces

### `runOrchestration(session, deps): Promise<string>`

Main entry point. Takes an orchestration session and dependencies, runs all subtasks concurrently, delivers per-subtask progress and a final summary.

**Parameters**:

- `session`: `OrchestrationSession` — the user request decomposed into subtasks
- `deps`: `OrchestrationDeps` — injected dependencies (adapter, processor, approval queue)

**Returns**: `Promise<string>` — the combined summary text (also delivered via LiveMessage)

**Behavior**:

1. Creates one `LiveMessage` per subtask
2. Starts all subtask runners concurrently
3. Waits for all to settle (`Promise.allSettled`)
4. Builds and delivers the combined summary
5. Disposes all LiveMessages

### `createSubtaskRunner(plan, live, deps): () => Promise<SubtaskResult>`

Creates a function that runs a single subtask.

**Parameters**:

- `plan`: `SubtaskPlan` — the subtask to execute
- `live`: `LiveMessage` — the live message for this subtask's progress
- `deps`: `SubtaskRunnerDeps` — processor, approval queue ref

**Returns**: A thunk that, when called, runs the subtask and returns `SubtaskResult`

### `createApprovalQueue(askFn): ApprovalQueue`

Creates a sequential approval queue for the orchestration session.

**Parameters**:

- `askFn`: `(taskId, items) => Promise<"approve" | "deny">` — the underlying approval mechanism

**Returns**: `ApprovalQueue` with:

- `enqueue(taskId, items): Promise<"approve" | "deny">` — enqueue an approval request, returns when resolved
- `dispose(): void` — reject any remaining queued entries

### `buildOrchestrationSummary(results): string`

Aggregates subtask results into a formatted summary string.

**Parameters**:

- `results`: `SubtaskResult[]`

**Returns**: Formatted summary text with success/failure per subtask

## AI Tool Contract

### `parallel_tasks` tool

**Description**: Decompose a complex user request into independent subtasks for parallel execution.

**Parameters** (Zod schema):

- `tasks`: array of objects, each with:
  - `label`: string — short human-readable description
  - `prompt`: string — full prompt for the subtask

**Constraints**:

- Minimum 2 tasks (otherwise use normal single-task flow)
- Maximum 5 tasks
- Each prompt must be self-contained (no references to other subtask results)

**Execute behavior**: Does not execute the subtasks itself. Returns a structured plan that the gateway handler detects and delegates to the orchestrator.
