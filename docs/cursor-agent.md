# Cursor CLI Agent Delegation

CloseClaw can delegate coding tasks to a local Cursor CLI agent.
When you ask the bot to perform coding work (refactoring, fixing
lint, writing tests, building projects), the AI agent spawns a
Cursor session and streams progress back to you.

## Prerequisites

- **Cursor CLI** (`cursor-agent`) must be installed and on `PATH`
- **node-pty** must be available (installed as a dependency)
- Cursor must be authenticated (logged in)

Verify with:

```bash
cursor-agent -v
```

## How It Works

1. You send a coding task via Telegram
2. The AI agent calls the `cursor_agent` tool
3. CloseClaw spawns Cursor CLI in a PTY with JSON streaming
4. Real-time progress (file writes, commands, AI messages) is
   streamed to your chat
5. If Cursor rejects a risky operation, you're asked for approval
6. A summary is delivered when complete

## Execution Modes

### Interactive Mode (Default)

Cursor runs without `--force`. Its built-in safety rules decide
which operations to allow. When a tool is rejected:

1. CloseClaw detects the rejection from the JSON event stream
2. Sends you a Telegram message listing the blocked commands
3. You reply **Accept** or **Deny**
4. If accepted, CloseClaw resumes the **same session** with
   `--resume` and `--force` — Cursor remembers all prior context
5. If denied or timed out (2 minutes), the task completes with
   a note that blocked operations were skipped

**Example flow:**

> You: Use cursor to build a React app in ~/projects/my-app
>
> Bot: Delegating to Cursor agent...
> Bot: Writing package.json
> Bot: Writing src/App.tsx
> Bot: Running: npm install
> Bot: Cursor needs approval to run:
> • npm install
> Reply Accept or Deny
>
> You: Accept
>
> Bot: Resuming with approval...
> Bot: Running: npm install
> Bot: Cursor ran successfully! Here's the summary: ...

### Trust Mode

Used only when explicitly requested. Cursor runs with `--force`
and auto-approves all operations.

**When to use:** Only when you fully trust the task and want no
prompts. Explicitly say "trust mode" or "force mode" in your
message.

### Mode Selection

Interactive mode is always the default. The AI agent does not
pick trust mode unless you explicitly ask for it.

## Real-Time Progress

Both modes stream JSON events from Cursor CLI. Progress messages
are sent to your chat as they happen:

| Event Type    | Message Example                     |
| ------------- | ----------------------------------- |
| File write    | `Writing index.ts`                  |
| Shell command | `Running: npm install`              |
| File read     | `Reading package.json`              |
| AI message    | Complete sentences from Cursor's AI |

Progress throttling:

- **Tool calls** (file writes, commands) are sent immediately
- **AI text messages** are throttled to one every 3 seconds
- Messages over 300 characters are truncated

## Session Resume

If a Cursor session is interrupted, you can resume it:

- "Resume the last cursor task"
- "Continue where cursor left off"

Sessions are stored in a temporary file and pruned after 24 hours.

## Configuration

| Setting           | Default    | Description                          |
| ----------------- | ---------- | ------------------------------------ |
| Timeout           | 10 minutes | Maximum task duration                |
| Approval timeout  | 2 minutes  | Auto-deny if no response             |
| Progress throttle | 3 seconds  | Min interval between AI text updates |

## Technical Details

Both modes use the same Cursor CLI flags:

```
cursor-agent -p --trust --output-format stream-json --stream-partial-output
```

- Interactive mode omits `--force` — Cursor's safety rules apply
- Trust mode adds `--force` — all operations auto-approved
- Both run inside a `node-pty` pseudo-terminal for clean output
- JSON events are parsed line-by-line from the PTY stream

The approval flow works by:

1. Parsing `tool_call` completed events with `"rejected"` results
2. Collecting all rejected commands into a list
3. Sending the list to the user via the gateway's approval system
4. Using `--resume=<session_id> --force` to continue with approval

The project directory is auto-created if it doesn't exist.
