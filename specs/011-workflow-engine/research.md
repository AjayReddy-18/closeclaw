# Research: Workflow Engine

## R1: Build vs Integrate (n8n, Temporal, etc.)

**Decision**: Build a lean, in-process workflow engine.

**Rationale**: CloseClaw already has 80% of the building blocks — scheduler, tools, orchestrator, approval queue, live messages. Integrating n8n requires a separate server, PostgreSQL, 2GB+ RAM, and a $50K/year embed license. Temporal requires its own server + workers. These are full platforms, not embeddable libraries. Building our own keeps the single-process model, zero external dependencies, and chat-first UX.

**Alternatives considered**:

- n8n (full platform, too heavy, requires separate DB and server)
- n8n-runner (npm v0.0.5, barely maintained, pulls entire n8n-nodes-base)
- Temporal (enterprise-grade, requires Temporal server + Redis)
- Inngest / Trigger.dev (hosted, need internet, overkill for personal tool)
- ts-edge / OpenWorkflow / Tinyflow (lightweight but no pre-built connectors)

## R2: Workflow Definition Format

**Decision**: JSON internally, YAML as user-facing format for power users.

**Rationale**: JSON is native to TypeScript, aligns with existing persistence patterns (config.json, tasks.json, conversations), and requires no new dependency for internal use. YAML is offered as a user-facing format because it's more readable for hand-authoring. The `yaml` npm package will parse YAML into the same internal JSON structure.

**Alternatives considered**:

- YAML-only (would require YAML serialization for internal persistence too)
- JSON-only (harder for humans to hand-write)
- DSL (custom syntax is a maintenance burden)

## R3: Step Execution Model

**Decision**: Each step executes via `processMessage` — the same path as chat messages and scheduled tasks.

**Rationale**: This reuses the full AI agent pipeline including tool calling, MCP tools, continuation loop, and conversation context. Steps that need tool calls (Jira, HTTP, shell) get them automatically via the AI model's tool selection. Steps that need pure AI reasoning (summarize, analyze) also work naturally. No need to build a separate tool dispatcher.

**Alternatives considered**:

- Direct tool invocation (bypassing AI model) — faster but loses AI reasoning, conditional logic would need a custom expression engine
- Hybrid (some steps direct, some via AI) — complexity not justified for v1

## R4: Condition Evaluation

**Decision**: AI-evaluated conditions. The AI model receives the previous step's output and the condition description, then returns a boolean decision.

**Rationale**: Using the AI for condition evaluation means conditions can be expressed in natural language ("if there are critical bugs", "if the build passed"). This aligns with the chat-first UX and avoids building a custom expression parser. The AI model is already invoked per step via `processMessage`, so asking it to evaluate a condition is a natural extension.

**Alternatives considered**:

- Custom expression engine (JSONPath, regex matching) — precise but requires users to learn syntax
- Hybrid (simple conditions via expressions, complex via AI) — could be added later as an optimization

## R5: YAML Parsing Dependency

**Decision**: Add `yaml` npm package to the new `@closeclaw/workflow` package.

**Rationale**: The project currently has no YAML dependency. The `yaml` package (npm `yaml`) is the modern, TypeScript-native YAML parser (replaces `js-yaml`). It supports YAML 1.2, has zero dependencies, and is well-maintained.

**Alternatives considered**:

- js-yaml (older, less type-safe, YAML 1.1 by default)
- Custom parser (unnecessary)

## R6: Workflow Persistence

**Decision**: Follow the existing TaskStore atomic-write pattern. Workflows stored in `~/.closeclaw/workflows/` as individual JSON files per workflow. Execution history stored alongside.

**Rationale**: Consistent with existing patterns (conversations as individual files per sender, cron tasks as single JSON). Individual files prevent write contention and make it easy to inspect/backup individual workflows.

**Alternatives considered**:

- Single JSON file for all workflows (write contention, grows unbounded)
- SQLite (adds a dependency, overkill for personal tool)

## R7: Trigger Architecture

**Decision**: Three trigger types wired into existing infrastructure.

- **Cron**: Reuse `createTaskScheduler` with a workflow-specific executor
- **Webhook**: New HTTP routes on the existing gateway server
- **Chat keyword**: Pattern matching in the message handler before AI processing

**Rationale**: Cron infrastructure already exists and is battle-tested. The gateway already serves HTTP routes that can be extended. Chat keyword triggers are a simple string match before the AI pipeline.

## R8: Live Progress During Workflow Execution

**Decision**: One `LiveMessage` per workflow execution. Updates show the current step label (e.g., "[Step 2/5: Check CI] Running..."). After completion, finalize with summary.

**Rationale**: Per-step live messages (like orchestration) would flood the chat for workflows with many steps. A single updating message is cleaner. The existing `LiveMessage` with `update` → `finalize` supports this pattern.

## R9: Gateway Restart Behavior

**Decision**: Running workflows are NOT resumed after gateway restart. Saved workflow definitions and their triggers are restored (cron timers re-armed, webhook routes re-registered). Any workflow that was mid-execution at shutdown is recorded as "interrupted" in execution history.

**Rationale**: Resuming mid-execution workflows requires checkpointing per-step state, which adds significant complexity (Temporal-level concerns). For a personal automation tool, re-triggering is simpler and safer. Users can manually re-run via chat.

## R10: Resource Limits

**Decision**: Enforce via named constants.

- Maximum steps per workflow: 20
- Maximum parallel branches: 5
- Maximum loop iterations: 50
- Maximum concurrent running workflows per user: 3
- Approval timeout default: 5 minutes

**Rationale**: Prevents runaway resource consumption without being overly restrictive. Limits align with the "personal automation" use case, not enterprise-scale orchestration.
