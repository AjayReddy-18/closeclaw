# Quickstart: Cursor CLI Agent Delegation

## Prerequisites

1. Cursor CLI installed: `curl https://cursor.com/install -fsSL | bash`
2. Authenticated: `agent login` or `export CURSOR_API_KEY=your_key`
3. tmux installed: `brew install tmux` (macOS) or `sudo apt install tmux` (Linux)
4. CloseClaw gateway running: `pnpm closeclaw gateway start`

## Usage

### Delegate a coding task

Message the bot:

```
use cursor to fix the lint errors in /path/to/project
```

Or:

```
cursor: add unit tests for the utils module in ~/projects/my-app
```

### Execution modes

- **Safe mode** (default): Cursor asks permission before file changes. You approve/deny from Telegram.
- **Trust mode**: Cursor auto-applies all changes. Say "use trust mode" or "force mode" in your message.

### During execution

- You'll receive progress messages as Cursor works
- If in safe mode, you'll get permission prompts: reply "accept" or "deny"
- To cancel: send "cancel cursor task"

### Resume a previous session

```
resume the last cursor task
```

Or:

```
cursor resume
```

### Check session history

```
list cursor sessions
```

## Configuration

Timeout (default 10 minutes) can be adjusted in `~/.closeclaw/config.json`:

```json
{
  "cursorAgent": {
    "timeoutMs": 600000,
    "defaultMode": "safe"
  }
}
```
