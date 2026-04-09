# Quickstart: Interactive PTY Mode

## Prerequisites

1. **cursor-agent** CLI installed and on PATH
2. **Node.js 22+** with native build tools (Xcode CLT on macOS, build-essential on Linux)
3. **Existing CloseClaw setup** (`closeclaw onboard` completed, gateway working)

## Verify cursor-agent

```bash
cursor-agent -v
# Expected: 2026.04.08-a41fba1 or later
```

## Install node-pty dependency

```bash
cd packages/cursor-agent
pnpm add node-pty
```

If native compilation fails, check:

- macOS: `xcode-select --install`
- Linux: `sudo apt-get install -y build-essential`

## Run the gateway

```bash
pnpm closeclaw gateway start
```

You should see:

```
[cursor] Interactive PTY mode available
AI agent active: anthropic/claude-sonnet-4-6
```

## Test interactive mode

1. Open Telegram and send your bot a coding task:

   > "In my closeclaw project, add a hello-world.ts file that prints 'Hello World'"

2. You should see real-time progress messages:

   > "Creating file hello-world.ts..."
   > "Writing content..."

3. If Cursor needs permission (e.g., file write), you'll see:
   > "Cursor is asking: Allow write to hello-world.ts? [Accept / Deny]"
4. Reply "Accept" or "Deny" in Telegram.

5. After completion, you'll get a summary of changes made.

## Switch to trust mode

If you want to skip all permission prompts for a task, tell the bot:

> "Use trust mode — create a new React app in ~/projects/demo"

## Verify tests pass

```bash
pnpm test
```
