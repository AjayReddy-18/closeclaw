# Cursor CLI Agent Delegation

CloseClaw can delegate coding tasks to a local Cursor CLI agent. When you ask the bot to perform coding-related work (refactoring, fixing lint, writing tests, analyzing codebases), the AI agent automatically spawns a Cursor session and brings back the results.

## Prerequisites

- **Cursor CLI** (`agent` binary) must be installed and on your `PATH`
- **tmux** must be installed (required for safe/interactive mode)
- Cursor must be authenticated (logged in)

Verify with:

```bash
which agent    # should return a path
which tmux     # should return a path
```

## How It Works

1. You send a coding task via Telegram (e.g., "Use cursor to fix lint errors in /path/to/project")
2. The AI agent recognizes it as a coding task and calls the `cursor_agent` tool
3. CloseClaw spawns a Cursor CLI session with the task
4. Progress updates are streamed back to you
5. The final result is delivered when complete

## Execution Modes

### Trust Mode (`--force`)

Used for low-risk tasks. Cursor runs with full permissions, no approval prompts.

**When used**: lint fixes, formatting, doc generation, simple additions

**How it works**: Spawns `agent -p --force --output-format stream-json` and parses structured events from stdout.

### Safe Mode (interactive)

Used for high-risk tasks. Cursor's permission prompts are forwarded to you for approval.

**When used**: refactoring, architecture changes, deletions, config changes

**How it works**: Runs inside a tmux session. CloseClaw polls the terminal for approval prompts and forwards them to you. Your accept/deny response is relayed back.

### Mode Selection

The AI agent automatically picks the mode based on task risk. You can override explicitly:

- "Use cursor in trust mode to fix formatting"
- "Use safe mode to refactor the auth module"

## Session Resume

If a Cursor session is interrupted (timeout, manual cancel), you can resume it:

- "Resume the last cursor task"
- "Continue where cursor left off"

The AI agent uses the `cursor_resume` tool to pick up from where the session stopped.

## CLI Commands

### List Sessions

```bash
closeclaw cursor sessions
```

Shows recent Cursor sessions with their ID, prompt, status, and creation time.

## Configuration

### Timeout

The default timeout for Cursor sessions is 10 minutes (600,000ms). To change it, edit `~/.closeclaw/config.json`:

```json
{
  "cursorAgent": {
    "timeoutMs": 900000
  }
}
```

### Progress Updates

- Progress messages are throttled to at most 1 every 10 seconds
- A heartbeat message is sent after 60 seconds of silence
- Permission prompts in safe mode are forwarded within 2 seconds

## Examples

**Fix lint errors** (trust mode, auto-selected):

> You: Use cursor to fix all lint errors in /Users/me/project
>
> Bot: Cursor task completed: Fixed 12 lint errors across 5 files.

**Refactor a module** (safe mode, auto-selected):

> You: Use cursor to refactor the authentication module in /Users/me/project
>
> Bot: Cursor wants to edit 8 files. Accept or Deny?
>
> You: Accept
>
> Bot: Cursor task completed: Refactored auth module to use dependency injection.

**Resume a session**:

> You: Resume the last cursor task
>
> Bot: Cursor task completed: Continued and finished the refactoring.
