# Feature Specification: Cursor CLI Agent Delegation

**Feature Branch**: `007-cursor-cli-delegation`
**Created**: 2026-04-09
**Status**: Draft
**Input**: User description: "Implement Cursor CLI integration for delegating coding tasks from CloseClaw's Telegram bot to a headless Cursor agent, with interactive permission forwarding, session resume, and live progress streaming."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Delegate a Coding Task (Priority: P1)

A user messages the CloseClaw bot on Telegram asking it to perform a coding task (e.g., "use cursor to fix the lint errors in the PAS service"). CloseClaw recognizes this as a coding task, spawns a Cursor CLI headless session in a tmux shell targeting the specified project directory, and streams the agent's progress back to the user in real-time message chunks. Once the Cursor agent completes, CloseClaw delivers the final summary.

**Why this priority**: This is the core value proposition — delegating real coding work from a chat interface.

**Independent Test**: Can be fully tested by sending a coding request via Telegram and verifying that a Cursor agent runs headlessly and the output is delivered back to the user.

**Acceptance Scenarios**:

1. **Given** the gateway is running and Cursor CLI is installed, **When** the user sends "use cursor to add unit tests for the utils module", **Then** CloseClaw spawns a Cursor headless session, streams progress messages, and delivers the final result.
2. **Given** a Cursor task is running, **When** the task completes, **Then** CloseClaw sends a completion summary with what was changed.
3. **Given** a Cursor task is running, **When** the task fails or times out, **Then** CloseClaw notifies the user with the error and cleans up the session.

---

### User Story 2 - Interactive Permission Forwarding (Priority: P1)

When running without `--force` mode, the Cursor agent may request user approval before making file changes or running commands. CloseClaw detects this permission prompt from the tmux session output, forwards it to the user via Telegram (e.g., "Cursor wants to modify 3 files. Accept or Deny?"), waits for the user's response, and sends the decision back to the Cursor session via tmux keystrokes. The session stays alive while waiting.

**Why this priority**: Without this, the only option is `--force`/`--yolo` mode which gives the agent unrestricted access. Permission forwarding is critical for safety on production codebases.

**Independent Test**: Can be tested by running a Cursor task without `--force`, verifying the permission prompt appears in Telegram, responding with "accept", and confirming the agent continues.

**Acceptance Scenarios**:

1. **Given** a Cursor session is running in interactive mode (no `--force`), **When** Cursor requests permission to modify files, **Then** CloseClaw detects the prompt, sends it to the user via Telegram, and waits for a response.
2. **Given** a permission prompt was forwarded to the user, **When** the user replies "accept" or "yes", **Then** CloseClaw sends the approval keystroke to the tmux session and the agent continues.
3. **Given** a permission prompt was forwarded, **When** the user replies "deny" or "no", **Then** CloseClaw sends the denial keystroke and the agent skips that action.
4. **Given** a permission prompt was forwarded, **When** the user does not respond within a configurable timeout, **Then** CloseClaw auto-denies and notifies the user.

---

### User Story 3 - Live Progress Streaming (Priority: P2)

While a Cursor agent session is running, the user receives periodic progress updates in Telegram showing what the agent is currently doing (reading files, making changes, running commands). Updates are throttled to avoid message spam.

**Why this priority**: Keeps the user informed during long-running tasks. Without it, the user sees nothing for minutes and doesn't know if it's working.

**Independent Test**: Can be tested by starting a multi-step coding task and verifying that at least 2 intermediate progress messages arrive before the final result.

**Acceptance Scenarios**:

1. **Given** a Cursor session is actively producing output, **When** new meaningful output is detected, **Then** CloseClaw sends a progress message to the user.
2. **Given** progress messages are being sent, **When** output changes rapidly, **Then** messages are throttled to avoid flooding (no more than one every 10 seconds).
3. **Given** a Cursor session is running with no new output, **When** 60 seconds pass without progress, **Then** CloseClaw sends a "still working..." heartbeat.

---

### User Story 4 - Session Resume (Priority: P2)

If a Cursor session is interrupted (timeout, network drop, user cancels and wants to continue later), the user can resume it. CloseClaw uses Cursor CLI's `agent resume` or `agent --resume="[chat-id]"` to continue from where the session left off, preserving context and history.

**Why this priority**: Avoids wasting work on long-running tasks that get interrupted. The Cursor CLI natively supports session listing (`agent ls`) and resume.

**Independent Test**: Can be tested by starting a task, interrupting it, then sending "resume the last cursor task" and verifying it continues from the previous state.

**Acceptance Scenarios**:

1. **Given** a Cursor session was previously started and interrupted, **When** the user says "resume the last cursor task", **Then** CloseClaw retrieves the session ID and runs `agent resume` or `agent --resume="[chat-id]"`.
2. **Given** no previous sessions exist, **When** the user asks to resume, **Then** CloseClaw informs the user there are no sessions to resume.
3. **Given** multiple sessions exist, **When** the user asks to resume, **Then** CloseClaw lists recent sessions and lets the user pick one.

---

### User Story 5 - Execution Mode Selection (Priority: P3)

The user can choose the safety level for a task. Options include:

- **Safe mode** (default): Interactive permission forwarding. Cursor asks before modifying files.
- **Trust mode**: Auto-approve all changes (`--force`). Used for low-risk tasks like formatting, linting, or doc generation.

The CloseClaw agent intelligently suggests a mode based on the task description, but the user has final say.

**Why this priority**: Gives users control over risk tolerance without requiring them to understand CLI flags.

**Independent Test**: Can be tested by sending a lint-fix request (agent suggests trust mode) vs. a refactoring request (agent suggests safe mode), and verifying the suggested mode matches expectations.

**Acceptance Scenarios**:

1. **Given** a user requests a low-risk task like "fix lint errors", **When** CloseClaw delegates to Cursor, **Then** CloseClaw suggests trust mode but asks for confirmation before proceeding.
2. **Given** a user requests a high-risk task like "refactor the authentication module", **When** CloseClaw delegates, **Then** CloseClaw defaults to safe mode with permission forwarding.
3. **Given** the user explicitly says "use trust mode" or "use safe mode", **Then** CloseClaw respects the explicit choice regardless of task risk assessment.

---

### Edge Cases

- What happens when Cursor CLI is not installed on the machine?
- What happens when `CURSOR_API_KEY` is not set?
- What happens when a tmux session crashes mid-task?
- What happens when the user sends a new Cursor task while one is already running?
- What happens when the target project directory doesn't exist?
- What happens when the Cursor agent enters an infinite loop or runs for too long?
- What happens when the user sends follow-up messages during an active Cursor session?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST be able to spawn a Cursor CLI agent session in a tmux shell and capture its output.
- **FR-002**: System MUST detect Cursor CLI availability and authentication status before attempting to run tasks.
- **FR-003**: System MUST stream progress from the Cursor session to the user via the bot platform in real-time.
- **FR-004**: System MUST detect permission prompts in Cursor's output and forward them to the user for approval.
- **FR-005**: System MUST relay the user's approval/denial decision back to the Cursor session via tmux keystrokes.
- **FR-006**: System MUST support session resume using Cursor CLI's `agent resume` and `agent --resume="[chat-id]"` capabilities.
- **FR-007**: System MUST enforce a configurable timeout for Cursor sessions to prevent runaway execution.
- **FR-008**: System MUST clean up tmux sessions when tasks complete, fail, or are cancelled.
- **FR-009**: System MUST support both safe mode (interactive permissions) and trust mode (`--force`) for task execution.
- **FR-010**: System MUST preserve Cursor's native capabilities including MCP servers, rules, commands, and skills loaded from the project.
- **FR-011**: System MUST allow the user to cancel a running Cursor task from the bot platform.
- **FR-012**: System MUST prevent concurrent Cursor sessions from the same user (queue or reject).

### Key Entities

- **CursorSession**: Represents an active or completed Cursor CLI session — includes session ID (chat-id), tmux session name, project directory, execution mode, status, and timestamps.
- **PermissionRequest**: A detected approval prompt from the Cursor agent — includes the prompt text, session reference, and user response.
- **TaskResult**: The outcome of a Cursor session — includes status (completed/failed/cancelled/timed-out), summary of changes, and output log.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can delegate coding tasks from the chat platform and receive results without leaving the conversation.
- **SC-002**: Permission prompts are detected and forwarded within 5 seconds of appearing in the Cursor session.
- **SC-003**: Progress messages reach the user at least every 30 seconds during active task execution.
- **SC-004**: Session resume restores full context from the previous session.
- **SC-005**: Runaway sessions are terminated within the configured timeout (default 10 minutes).
- **SC-006**: All test coverage thresholds are maintained at 90% or above.

## Assumptions

- Cursor CLI (`agent` command) is installed on the host machine and authenticated via `CURSOR_API_KEY` or browser login.
- `tmux` is installed on the host machine (required for TTY emulation).
- The host machine has access to the project directories that the user wants the Cursor agent to work on.
- The Cursor agent's own tool capabilities (MCPs, rules, skills) are configured per-project in the standard locations (`.cursor/rules`, `mcp.json`, etc.) and CloseClaw does not need to manage them.
- Session data from `agent ls` is available and parseable for the resume feature.
- The user interacts with one Cursor task at a time per platform identity (no parallel Cursor sessions per user).
