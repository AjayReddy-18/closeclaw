# Feature Specification: Workflow Engine

**Feature Branch**: `011-workflow-engine`
**Created**: 2026-04-05
**Status**: Draft
**Input**: User description: "Chat-driven workflow engine with conditional branching, parallel steps, loops, multiple trigger types, human-in-the-loop pauses, one-shot and reusable workflows. Users create workflows via natural language in chat or hand-written YAML."

## Clarifications

### Session 2026-04-05

- Q: When a workflow is created via chat, should it also write a YAML file to disk? → A: Yes — save both JSON (internal) and a human-readable YAML copy in ~/.closeclaw/workflows/definitions/
- Q: Should one-shot workflows keep execution history? → A: Yes — keep full execution records in ~/.closeclaw/workflows/history/ just like saved workflows

## User Scenarios & Testing

### User Story 1 — Create and Run a Reusable Workflow via Chat (Priority: P1)

A user sends a natural language message to the bot describing a multi-step automated process they want to repeat. The bot interprets the request, constructs a structured workflow definition, confirms it with the user, and saves it. The workflow fires automatically based on its trigger and executes all steps, delivering results to the user.

**Why this priority**: This is the core value proposition — turning a chat message into a persistent, repeatable automation without the user needing to learn any syntax or open any other tool.

**Independent Test**: Can be fully tested by sending a chat message like "Every morning at 9am, check my open Jira tickets and send me a summary", verifying the workflow is created, and observing it fire on schedule.

**Acceptance Scenarios**:

1. **Given** the bot is running and the user has MCP tools configured, **When** the user sends "Every weekday at 9am, check my Jira board and if there are any critical bugs, alert me — otherwise just say all clear", **Then** the bot creates a workflow with a cron trigger, a Jira tool step, a conditional branch, and two outcome paths, confirms the definition with the user, and saves it.
2. **Given** a saved workflow with a cron trigger, **When** the scheduled time arrives, **Then** the workflow executes each step in order, evaluates conditions based on step outputs, and delivers the appropriate result to the user as a chat message.
3. **Given** the user reviews the workflow confirmation, **When** the user says "no" or requests a change, **Then** the bot adjusts the workflow definition accordingly before saving.

---

### User Story 2 — Run a One-Shot Workflow (Priority: P1)

A user describes a multi-step task that should run immediately and only once. The bot decomposes it into sequential/conditional steps and executes them right away without saving a persistent workflow definition. This is for ad-hoc needs like "fetch the latest deploy status, and if it failed, create a Jira ticket with the error logs."

**Why this priority**: Equally important as reusable workflows — many tasks are situational and shouldn't clutter the saved workflow list.

**Independent Test**: Can be tested by sending a multi-step request, verifying all steps execute in order with correct condition handling, and confirming no workflow definition is persisted afterward.

**Acceptance Scenarios**:

1. **Given** the bot is running, **When** the user sends "Check the CI build for project X, if it passed deploy to staging, if it failed create a Jira ticket", **Then** the bot immediately executes the steps sequentially, evaluating conditions, and sends the final result.
2. **Given** a one-shot workflow with three steps, **When** the second step fails, **Then** the bot reports the failure with context from the failed step and does not execute subsequent steps (unless an error-handling path is defined).
3. **Given** a one-shot workflow completes, **When** the user later asks to see their workflows, **Then** the one-shot workflow does not appear in the saved list.

---

### User Story 3 — Create a Workflow via YAML (Priority: P2)

A power user writes a workflow definition in YAML format and sends it to the bot (or saves it to a file). The bot validates the YAML, confirms the workflow structure, and saves/runs it. This gives full control over step definitions, conditions, and advanced features.

**Why this priority**: Important for power users who want precision and repeatability, but most users will prefer the natural language path.

**Independent Test**: Can be tested by sending a YAML workflow definition via chat, verifying it is parsed and validated, and confirming it executes correctly.

**Acceptance Scenarios**:

1. **Given** the bot is running, **When** the user sends a YAML workflow definition with a trigger, steps, and conditions, **Then** the bot validates the schema, confirms the workflow with the user, and saves it.
2. **Given** an invalid YAML definition (missing required fields, bad condition syntax), **When** the user submits it, **Then** the bot returns a clear error message identifying the specific validation failures.
3. **Given** a valid YAML workflow, **When** the user sends it with a "run once" directive, **Then** the bot executes it immediately without saving.

---

### User Story 4 — Workflow with Human-in-the-Loop Approval (Priority: P2)

A workflow includes a pause point where it waits for user approval before proceeding. The bot sends an approval prompt, and the workflow resumes or aborts based on the user's response.

**Why this priority**: Critical for workflows that perform irreversible or high-impact actions (deployments, ticket creation, notifications to external parties).

**Independent Test**: Can be tested by creating a workflow with an approval step, verifying execution pauses and the user receives a prompt, and confirming the workflow resumes or aborts correctly.

**Acceptance Scenarios**:

1. **Given** a running workflow reaches an approval step, **When** the step fires, **Then** the bot sends the user a message with context about what will happen next and buttons/commands to approve or deny.
2. **Given** the user approves, **When** the approval is received, **Then** the workflow resumes from where it paused and continues executing subsequent steps.
3. **Given** the user denies, **When** the denial is received, **Then** the workflow stops execution, records the outcome as "aborted by user", and notifies the user.
4. **Given** the user does not respond within a configurable timeout, **When** the timeout expires, **Then** the workflow aborts and notifies the user that it timed out.

---

### User Story 5 — Parallel Step Execution (Priority: P2)

A workflow contains steps that can run concurrently. The workflow engine fans out parallel branches, waits for all to complete, and merges results before proceeding to the next step.

**Why this priority**: Enables faster workflows for independent checks (e.g., "check Jira AND check CI AND check Datadog" simultaneously).

**Independent Test**: Can be tested by creating a workflow with a parallel block containing three independent steps, verifying all three execute concurrently, and confirming the next step receives merged results.

**Acceptance Scenarios**:

1. **Given** a workflow with a parallel block of three steps, **When** the block executes, **Then** all three steps run concurrently and the workflow waits for all to complete before proceeding.
2. **Given** a parallel block where one step fails, **When** all steps complete, **Then** the merged result includes the failure, and subsequent steps can branch based on which steps succeeded or failed.

---

### User Story 6 — Workflow with Loops (Priority: P3)

A workflow includes a loop that repeats a set of steps until a condition is met or a maximum iteration count is reached. Useful for polling scenarios ("check deploy status every 5 minutes until it succeeds or 30 minutes pass").

**Why this priority**: Polling/retry patterns are common but less frequent than linear or branching workflows.

**Independent Test**: Can be tested by creating a workflow with a loop that polls a status endpoint, verifying it repeats until the condition is met, and confirming it respects the maximum iteration limit.

**Acceptance Scenarios**:

1. **Given** a workflow with a loop step that polls a service, **When** the service returns a "not ready" status, **Then** the loop waits the specified interval and retries.
2. **Given** a loop with a maximum of 6 iterations, **When** the condition is never met after 6 attempts, **Then** the loop exits, the workflow continues to the next step (or an error path), and the user is notified.
3. **Given** a loop where the condition is met on the third iteration, **When** the condition evaluates to true, **Then** the loop exits immediately and the workflow proceeds with the successful result.

---

### User Story 7 — Manage Saved Workflows (Priority: P3)

A user can list, view, enable, disable, edit, and delete their saved workflows via chat or CLI commands.

**Why this priority**: Operational necessity once workflows are created, but not needed until the core engine works.

**Independent Test**: Can be tested by creating several workflows, then listing, disabling, re-enabling, editing, and deleting them via chat commands.

**Acceptance Scenarios**:

1. **Given** the user has three saved workflows, **When** the user asks "list my workflows", **Then** the bot displays all three with their names, triggers, status (enabled/disabled), and last run time.
2. **Given** a saved workflow, **When** the user says "disable morning-jira-check", **Then** the workflow is disabled and its trigger stops firing.
3. **Given** a disabled workflow, **When** the user says "enable morning-jira-check", **Then** the workflow is re-enabled and its trigger resumes.
4. **Given** a saved workflow, **When** the user says "delete morning-jira-check", **Then** the bot asks for confirmation and removes it upon approval.

---

### User Story 8 — Webhook-Triggered Workflow (Priority: P3)

A workflow is triggered by an incoming HTTP webhook rather than a schedule or chat command. This allows external systems (CI/CD, monitoring, third-party services) to kick off workflows.

**Why this priority**: Powerful for integration but requires external setup; most users will start with cron and chat triggers.

**Independent Test**: Can be tested by creating a webhook-triggered workflow, sending an HTTP POST to the webhook URL, and verifying the workflow executes with the webhook payload available as step context.

**Acceptance Scenarios**:

1. **Given** a workflow with a webhook trigger, **When** the workflow is saved, **Then** the system generates a unique webhook URL and reports it to the user.
2. **Given** a webhook URL, **When** an external system sends an HTTP POST with a JSON payload, **Then** the workflow executes with the payload data accessible in step conditions and prompts.
3. **Given** a webhook request with an invalid or missing authentication token, **When** the request arrives, **Then** the system rejects it and does not trigger the workflow.

---

### Edge Cases

- What happens when a workflow step references a tool/MCP server that is not currently connected?
- How does the system handle a workflow that has been running for a very long time (e.g., a loop that waits hours)?
- What happens if the gateway restarts while a workflow is mid-execution?
- What happens when two workflows trigger at the same time and both need approval?
- How does the system handle a workflow whose YAML definition references a step output that doesn't exist (typo in output reference)?
- What happens if a user creates a workflow that would exceed a reasonable resource limit (e.g., 100 parallel steps)?

## Requirements

### Functional Requirements

- **FR-001**: System MUST support defining workflows as an ordered graph of steps with optional conditions, parallel blocks, loops, and approval pauses.
- **FR-002**: System MUST support creating workflows from natural language chat messages, with the AI interpreting the user's intent and generating a structured workflow definition.
- **FR-003**: System MUST support creating workflows from hand-written YAML definitions submitted via chat.
- **FR-004**: System MUST validate workflow definitions (both AI-generated and YAML-submitted) against a schema before saving or executing.
- **FR-005**: System MUST support three trigger types: cron schedule, webhook (HTTP POST), and chat keyword/command.
- **FR-006**: System MUST support one-shot workflows that execute immediately. The workflow definition is not persisted, but the execution record MUST be saved to history.
- **FR-007**: System MUST support reusable workflows that are saved, triggered automatically, and can be managed (list, view, enable, disable, edit, delete).
- **FR-008**: System MUST support conditional branching — evaluating a condition against the output of a previous step and choosing which path to follow.
- **FR-009**: System MUST support parallel step execution — running multiple independent steps concurrently and merging results before continuing.
- **FR-010**: System MUST support loops — repeating a set of steps with a delay interval until a condition is met or a maximum iteration count is reached.
- **FR-011**: System MUST support human-in-the-loop approval pauses — halting execution, prompting the user, and resuming or aborting based on the response.
- **FR-012**: System MUST deliver workflow execution results (success, partial failure, or error) to the user via their chat platform.
- **FR-013**: System MUST provide live progress updates during workflow execution, showing which step is currently running.
- **FR-014**: System MUST isolate step failures — a failure in one step should not crash the engine; it should follow the defined error path or stop gracefully and report.
- **FR-015**: Each workflow step MUST be able to use any available tool (built-in tools, MCP server tools, AI agent prompts) as its action.
- **FR-016**: Steps MUST be able to reference outputs from previous steps in their prompts, conditions, and parameters.
- **FR-017**: System MUST persist saved workflow definitions in both JSON (internal) and human-readable YAML format to survive gateway restarts. Both files MUST be written to ~/.closeclaw/workflows/definitions/.
- **FR-018**: System MUST confirm AI-generated workflow definitions with the user before saving.
- **FR-019**: System MUST enforce resource limits — maximum number of steps per workflow, maximum parallel branches, maximum loop iterations, and maximum concurrent running workflows.
- **FR-020**: Webhook-triggered workflows MUST authenticate incoming requests using a per-workflow secret token.
- **FR-021**: Approval pauses MUST respect a configurable timeout, defaulting to automatic denial if the user does not respond.
- **FR-022**: System MUST record execution history for ALL workflows — both saved and one-shot — including timestamp, status, duration, and step-by-step outcomes.
- **FR-023**: System MUST support managing workflows via CLI commands in addition to chat.

### Key Entities

- **Workflow Definition**: A named, structured description of an automation — includes a trigger, an ordered graph of steps, and metadata (owner, status, creation date). Can be reusable (saved) or one-shot (ephemeral).
- **Step**: A single unit of work within a workflow — has an action (tool call or AI prompt), optional input references to previous step outputs, and optional conditions for branching.
- **Trigger**: The event that starts a workflow — cron schedule, webhook, or chat keyword.
- **Condition**: A rule that evaluates against step outputs to determine which path to follow — supports simple comparisons (contains, equals, greater-than) and boolean logic.
- **Execution Record**: A timestamped log of a workflow run — includes overall status, per-step outcomes, duration, and any errors or user decisions.
- **Step Output**: The result produced by a step — stored in a per-execution context so subsequent steps can reference it by step name or ID.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can create a reusable multi-step workflow from a single natural language chat message in under 60 seconds.
- **SC-002**: Users can create a workflow from YAML with validation feedback in under 10 seconds.
- **SC-003**: Workflow execution with 5 sequential steps completes within 2x the sum of individual step durations (minimal orchestration overhead).
- **SC-004**: Parallel steps execute concurrently — a workflow with 3 parallel steps each taking 10 seconds completes in under 15 seconds total (not 30+).
- **SC-005**: Human-in-the-loop approval prompts are delivered to the user within 3 seconds of the workflow reaching the pause point.
- **SC-006**: All saved workflows survive gateway restarts without data loss.
- **SC-007**: Webhook-triggered workflows begin execution within 2 seconds of receiving the HTTP request.
- **SC-008**: Users can manage (list, enable, disable, delete) their workflows entirely through chat without using the CLI.
- **SC-009**: A failing step does not crash other running workflows or the gateway.
- **SC-010**: Workflow execution history is queryable — users can ask "show me the last 5 runs of morning-jira-check" and get results.

## Assumptions

- The user already has CloseClaw onboarded with at least one bot platform and an AI agent configured (Features 001-002).
- The AI model used is capable of interpreting multi-step workflow requests and generating structured output (all currently supported models can do this with proper prompting).
- MCP tools referenced in workflow steps are already configured and connected via the existing MCP integration (Feature 006).
- Workflow definitions and execution history are stored locally on the machine running the gateway (same persistence model as conversations and cron tasks).
- Webhook endpoints are accessible only from the same network as the gateway unless the user explicitly exposes the gateway port.
- The existing approval queue infrastructure (Feature 010) can be reused for human-in-the-loop pauses.
- The existing live message system (Feature 009) can be reused for per-step progress updates.
- Loop iteration delays and approval timeouts are measured in seconds/minutes, not days — workflows are not designed for multi-day sagas.
