# Cursor CLI Agent Delegation

CloseClaw can delegate coding tasks to a local Cursor CLI agent. When you ask the bot to perform coding-related work (refactoring, fixing lint, writing tests, analyzing codebases), the AI agent automatically spawns a Cursor session and brings back the results.

## Prerequisites

- **Cursor CLI** (`cursor-agent` binary) must be installed and on your `PATH`
- **node-pty** must be available (installed as a dependency)
- Cursor must be authenticated (logged in)

Verify with:

```bash
cursor-agent -v    # should print version
```

## How It Works

1. You send a coding task via Telegram (e.g., "Use cursor to fix lint errors in /path/to/project")
2. The AI agent recognizes it as a coding task and calls the `cursor_agent` tool
3. CloseClaw spawns a Cursor CLI session inside a pseudo-terminal (PTY)
4. Real-time progress updates are streamed back to you
5. Permission prompts are forwarded to you for accept/deny
6. A structured summary is delivered when complete

## Execution Modes

### Interactive Mode (default)

The default for all tasks. Cursor runs in a real pseudo-terminal with no `--force` flag. Permission prompts are detected and relayed to you via Telegram.

**Features**:

- Real-time progress streaming to Telegram
- Permission prompts forwarded with Accept/Deny options
- 2-minute auto-deny timeout on unanswered prompts
- Structured completion summary with file operations

**How it works**: Spawns Cursor CLI in a `node-pty` pseudo-terminal, strips ANSI escape codes from output, detects permission prompt patterns, and relays decisions via keystroke input to the PTY.

### Trust Mode (explicit override only)

Used only when you explicitly request it. Cursor runs with `--force` and auto-approves everything.

**When to use**: Only if you fully trust the task and want zero prompts.

**How it works**: Spawns `cursor-agent -p --force --output-format stream-json` and parses structured JSON events from stdout.

### Mode Selection

Interactive is always the default. Trust mode requires explicit override:

- "Use cursor in trust mode to fix formatting"
- "Use force mode to build the project"

The AI agent no longer picks modes automatically — interactive mode is safe by default.

## Permission Prompts

When Cursor CLI asks for permission (e.g., editing files, running commands, workspace trust), CloseClaw:

1. Detects the prompt from PTY output
2. Sends the prompt text to you via Telegram with a request to reply Accept or Deny
3. Waits up to 2 minutes for your response
4. Auto-denies if no response within the timeout
5. Writes your decision as a keystroke back to the PTY

## Session Resume

If a Cursor session is interrupted, you can resume it:

- "Resume the last cursor task"
- "Continue where cursor left off"

Resumed sessions use interactive mode with full permission support.

## Completion Summary

When Cursor finishes a task, you receive a structured summary including:

- **Status**: completed, failed, or timed out
- **Files**: list of created, modified, and deleted files
- **Commands**: shell commands that were executed
- **Permissions**: how many were requested, accepted, and denied

## Configuration

### Timeout

Default timeout is 10 minutes (600,000ms). Progress messages are throttled to 1 every 10 seconds.

### Permission Timeout

Permission prompts auto-deny after 2 minutes of no response.

## Examples

**Build a project** (interactive mode):

> You: Use cursor to build a React app in /Users/me/project
>
> Bot: Delegating to Cursor agent...
>
> Bot: Creating project structure...
>
> Bot: Cursor is asking: Run `npm install`? Reply Accept or Deny
>
> You: Accept
>
> Bot: Status: completed
> Files:
> created: src/App.tsx
> created: package.json
> created: tsconfig.json
> Commands: npm install
> Permissions: 1 accepted, 0 denied of 1

**Fix lint errors** (trust mode, explicitly requested):

> You: Use cursor in trust mode to fix all lint errors in /Users/me/project
>
> Bot: Cursor task completed: Fixed 12 lint errors across 5 files.

**Resume a session**:

> You: Resume the last cursor task
>
> Bot: Cursor task completed: Continued and finished the refactoring.
