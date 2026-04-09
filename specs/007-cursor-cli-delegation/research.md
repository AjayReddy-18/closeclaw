# Research: Cursor CLI Agent Delegation

## R1: Output Capture Strategy

**Decision**: Use two execution strategies based on mode.

- **Trust mode** (`--force`): Run via `child_process.spawn` with `--output-format stream-json --stream-partial-output`. Parse structured JSON events (types: `system`, `assistant`, `tool_call`, `result`) from stdout line-by-line. No tmux needed.
- **Safe mode** (interactive): Run inside tmux session for TTY. Poll `tmux capture-pane -p` on interval to detect output changes and permission prompts. Send user decisions via `tmux send-keys`.

**Rationale**: `stream-json` is cleaner and avoids tmux overhead for the common case. tmux is reserved for the interactive case where a real TTY is required for Cursor's TUI to show approval prompts.

**Alternatives considered**:

- tmux-only approach: Simpler to implement one path, but tmux overhead is unnecessary for trust mode and output parsing from raw terminal text is fragile.
- `--output-format text` only: Loses tool call tracking and progress granularity.

## R2: Interactive Permission Detection

**Decision**: Poll `tmux capture-pane -p -S -50` every 2 seconds. Match permission prompt patterns in the captured output (e.g., lines containing "Accept", "Deny", approval-related TUI elements). When detected, forward to user and wait.

**Rationale**: Cursor's interactive mode uses a TUI that requires a real terminal. There is no structured API for permission events — the only way to detect them is by reading the terminal screen buffer.

**Alternatives considered**:

- `stream-json` in safe mode: Cursor doesn't emit permission events in stream-json when running interactively — it needs a TTY.
- screen instead of tmux: tmux is more widely installed and better documented for this use case.

## R3: Session Management

**Decision**: Use `cursor agent ls` to list sessions and `cursor agent --resume=<chat-id>` to resume. Keep a lightweight in-memory `Map` of CloseClaw-spawned sessions during gateway lifetime, backed by a temp file (`os.tmpdir()/closeclaw-cursor-sessions.json`) for gateway restart resilience. Entries older than 24h are pruned on startup. No permanent storage — Cursor CLI manages its own session persistence natively.

**Rationale**: Cursor stores sessions internally but `agent ls` shows ALL sessions (including manually started ones). The thin mapping lets CloseClaw quickly identify its own sessions for the resume flow. Using temp storage instead of permanent storage avoids accumulating stale data. Falls back to `agent ls` + user selection when no CloseClaw session is found.

**Alternatives considered**:

- Permanent `~/.closeclaw/cursor-sessions.json`: Unnecessary — old session data is useless and Cursor manages its own persistence.
- No mapping at all (just `agent ls`): Works but requires the user to pick from all sessions including non-CloseClaw ones.
- Cloud execution (`-c` / `--cloud`): Future enhancement possibility but adds dependency on Cursor cloud subscription tier.

## R4: New Package or Existing Package

**Decision**: Create a new `packages/cursor-agent` package to encapsulate all Cursor CLI interaction logic (session spawning, output parsing, tmux orchestration, session tracking). Expose a clean interface consumed by the AI agent tools.

**Rationale**: Follows the constitution's Modular Architecture principle. Cursor CLI interaction is a distinct concern from the AI agent, bot adapters, or MCP client.

**Alternatives considered**:

- Add to existing `packages/ai-agent`: Violates single responsibility. Cursor CLI is an external tool integration, not part of the AI reasoning pipeline.

## R5: Tool Integration

**Decision**: Register two new AI tools: `cursor_agent` (delegate a task) and `cursor_resume` (resume a session). These tools are built-in (not MCP) and available when Cursor CLI is detected on the machine.

**Rationale**: The CloseClaw AI agent decides when to delegate to Cursor based on user intent. Making it a tool lets the AI reason about when to use it vs. handling the request itself.

**Alternatives considered**:

- Direct command detection (regex on user message): Fragile, doesn't leverage AI reasoning.
- MCP tool: Cursor CLI is a local binary, not an MCP server. Making it a native tool is simpler.

## R6: Timeout and Cleanup

**Decision**: Configurable timeout per session (default 10 minutes). Stored in `~/.closeclaw/config.json` under `cursorAgent.timeoutMs`. On timeout: kill the tmux session or child process, notify the user, record the session ID for potential resume.

**Rationale**: Prevents runaway sessions. The session is still resumable after timeout since Cursor CLI preserves conversation state.

## R7: System Prompt Awareness

**Decision**: Add a "Cursor Agent" section to the system prompt (similar to MCP Integrations) informing the AI that it can delegate coding tasks to a local Cursor agent. Include guidance on when to use it (coding/refactoring/testing tasks) vs. when not to (simple questions, non-code tasks).

**Rationale**: Same pattern as MCP tool awareness — the AI needs to know the capability exists to use it effectively.
