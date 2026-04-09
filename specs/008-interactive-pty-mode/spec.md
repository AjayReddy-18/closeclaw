# Feature Specification: Interactive PTY Mode for Cursor Agent

**Feature Branch**: `008-interactive-pty-mode`
**Created**: 2026-04-10
**Status**: Draft
**Input**: User description: "Yes, I want truly Interactive build with pty"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Real-Time Progress Visibility (Priority: P1)

As a user delegating a coding task via Telegram, I want to see clean, real-time progress updates showing what the Cursor agent is doing — which files it's reading, editing, which commands it's running — so I know the task is progressing and what's happening without guessing.

**Why this priority**: Without clear progress, the user has no confidence the task is running. This is the foundational experience that makes delegation useful.

**Independent Test**: Can be fully tested by delegating any coding task and verifying that the user sees periodic, human-readable status messages in Telegram showing Cursor's actions.

**Acceptance Scenarios**:

1. **Given** a user delegates a coding task, **When** the Cursor agent starts working, **Then** the user sees progress messages in Telegram within 10 seconds of each significant action (file read, file edit, command execution).
2. **Given** the Cursor agent is editing multiple files, **When** it moves to a new file, **Then** the user sees a message identifying which file is being worked on.
3. **Given** the Cursor agent runs a shell command, **When** the command starts, **Then** the user sees a message describing the command purpose (not raw command text).
4. **Given** the Cursor agent is thinking/planning, **When** it produces text output, **Then** the user sees the agent's reasoning or plan summary.

---

### User Story 2 - Interactive Permission Control (Priority: P1)

As a user, when the Cursor agent wants to perform a potentially risky action (delete files, modify configs, run destructive commands), I want to receive a permission prompt on Telegram and be able to accept or deny it, so I maintain control over what happens on my machine.

**Why this priority**: This is the core differentiator of interactive mode — without it, the user has no safety net and the mode is just "trust with extra steps."

**Independent Test**: Can be fully tested by delegating a task that triggers a permission prompt in Cursor, verifying the prompt appears in Telegram, responding with accept/deny, and confirming Cursor respects the decision.

**Acceptance Scenarios**:

1. **Given** the Cursor agent encounters a permission prompt, **When** the prompt is detected, **Then** the user receives a clear message on Telegram describing the action and options to Accept or Deny.
2. **Given** the user receives a permission prompt, **When** they respond with "Accept", **Then** the Cursor agent proceeds with the action and the user sees subsequent progress.
3. **Given** the user receives a permission prompt, **When** they respond with "Deny", **Then** the Cursor agent skips or works around the denied action.
4. **Given** a permission prompt is sent, **When** the user does not respond within 2 minutes, **Then** the system auto-denies the action and notifies the user.

---

### User Story 3 - Clean Final Summary (Priority: P2)

As a user, when the Cursor agent finishes a delegated task, I want a clear summary of what was accomplished — files created, files modified, commands run, any errors — so I know exactly what changed.

**Why this priority**: After delegation completes, the user needs to know the outcome before reviewing or using the result.

**Independent Test**: Can be fully tested by delegating a task to completion and verifying the final message contains a structured summary of changes.

**Acceptance Scenarios**:

1. **Given** the Cursor agent completes a task successfully, **When** the result is sent to the user, **Then** it includes a summary of files created/modified and overall outcome.
2. **Given** the Cursor agent fails or times out, **When** the result is sent, **Then** the user sees a clear explanation of what went wrong and what was partially completed.

---

### User Story 4 - Session Resume After Interruption (Priority: P3)

As a user, if a Cursor session is interrupted or I want to continue a previous task, I want to resume the session from where it left off, so work is not lost.

**Why this priority**: Nice-to-have resilience feature. The core interactive experience must work first.

**Independent Test**: Can be tested by starting a task, interrupting it, then asking to resume and verifying continuity.

**Acceptance Scenarios**:

1. **Given** a previous Cursor session exists, **When** the user asks to resume, **Then** the Cursor agent continues from the previous session context.
2. **Given** no previous sessions exist, **When** the user asks to resume, **Then** they receive a clear message that there's nothing to resume.

---

### Edge Cases

- What happens when the Cursor CLI process crashes mid-task?
- How does the system handle extremely long-running tasks that exceed the timeout?
- What happens if the user sends a new message while a Cursor task is in progress?
- How does the system handle multiple rapid permission prompts in sequence?
- What happens when the Telegram connection drops while waiting for a permission response?
- What happens if the Cursor CLI binary is updated/removed while a session is active?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST use a pseudo-terminal (PTY) to spawn the Cursor CLI agent, enabling real terminal interaction without a visible GUI.
- **FR-002**: System MUST parse the Cursor CLI's terminal output in real-time and extract meaningful progress events (file operations, command executions, text output).
- **FR-003**: System MUST detect permission prompts from Cursor CLI's terminal output using pattern matching.
- **FR-004**: System MUST forward detected permission prompts to the user via their messaging platform (Telegram) with clear Accept/Deny options.
- **FR-005**: System MUST relay the user's permission decision back to the Cursor CLI session by writing to the PTY input.
- **FR-006**: System MUST throttle progress messages to avoid flooding the user's chat (no more than one progress message per 8-10 seconds).
- **FR-007**: System MUST auto-deny permission prompts that receive no user response within 2 minutes.
- **FR-008**: System MUST produce a structured summary when the Cursor task completes, including files changed and overall outcome.
- **FR-009**: System MUST gracefully handle Cursor CLI process crashes, timeouts, and unexpected exits.
- **FR-010**: System MUST default to interactive mode (PTY with permission prompts) for all delegated tasks. Autonomous mode (auto-approve) MUST only be used when the user explicitly requests it (e.g., "use trust mode", "use force mode").
- **FR-011**: System MUST keep the Cursor CLI session alive while waiting for user permission responses.

### Key Entities

- **PTY Session**: Represents an active pseudo-terminal connection to a Cursor CLI process. Contains the process handle, input/output streams, and session metadata.
- **Permission Prompt**: A detected request from Cursor for user approval. Contains the action description, detection timestamp, response deadline, and user decision.
- **Progress Event**: A parsed update from Cursor's output. Contains event type (file_edit, command_run, text_output), description, and timestamp.
- **Task Result**: The final outcome of a delegated task. Contains status, summary, files changed, and output log.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users see at least one progress update within 15 seconds of task delegation starting.
- **SC-002**: Permission prompts appear in the user's chat within 3 seconds of Cursor requesting them.
- **SC-003**: User's accept/deny decision is relayed back to Cursor within 2 seconds of the response.
- **SC-004**: 100% of Cursor permission prompts are detected and forwarded (no silent auto-approvals in interactive mode).
- **SC-005**: Progress messages are human-readable — no garbled terminal fragments, raw escape sequences, or partial lines.
- **SC-006**: Task completion summary accurately reflects all files created or modified.
- **SC-007**: System maintains 90%+ test coverage for all new and modified code.

## Clarifications

### Session 2026-04-10

- Q: When the user doesn't specify a mode, should the AI auto-select or default to interactive? → A: Interactive (PTY) is the new default for all tasks; autonomous/trust requires explicit user override.

## Assumptions

- The `node-pty` package (or equivalent) is available and can be installed as a project dependency for PTY emulation on macOS.
- Cursor CLI's interactive mode (without `--print`) uses standard terminal patterns for permission prompts (e.g., "Accept / Deny", "Y/n" style prompts).
- The user has Cursor CLI installed and authenticated on the machine running CloseClaw.
- Permission prompts from Cursor follow detectable patterns that can be reliably identified via regex or string matching.
- The messaging platform (Telegram) supports sufficient message throughput for real-time progress updates.
- The existing trust mode (autonomous, `--force`) continues to work alongside the new interactive mode.
