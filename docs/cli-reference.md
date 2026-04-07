# CLI Reference

All commands are run via:

```bash
pnpm tsx packages/cli/src/index.ts <command>
```

## onboard

Interactive wizard for first-time bot setup.

```bash
closeclaw onboard
```

**Behavior:**

- Detects existing integrations in `~/.closeclaw/config.json`
- If integrations exist: offers to reset all, reset a specific
  platform, or add a new platform
- If no integrations: starts fresh setup
- Prompts for platform (Telegram or Discord), shows bot creation
  steps, collects bot token, validates it, and selects DM policy
- Auto-configures gateway settings (bind address, port, auth token)

**DM Policies:**

| Policy    | Description                                                           |
| --------- | --------------------------------------------------------------------- |
| pairing   | Default. Unapproved senders receive a pairing code to approve via CLI |
| allowlist | Only pre-approved sender IDs can message the bot                      |
| open      | Anyone can message (shows security warning)                           |

## gateway start

Runs the gateway as a foreground process.

```bash
closeclaw gateway start
```

**Behavior:**

- Loads configuration from `~/.closeclaw/config.json`
- Connects all enabled bot adapters
- Starts the HTTP server on the configured port
- If an AI agent is configured, activates message processing
- Logs accepted messages to stdout
- Shows continuous typing indicator while AI processes
- Sends "Processing your message..." after 5 seconds of processing
- Press Ctrl+C for graceful shutdown

**Endpoints:**

| Method | Path                 | Description                       |
| ------ | -------------------- | --------------------------------- |
| GET    | /health              | Gateway and adapter health status |
| GET    | /pairing/pending     | List pending pairing requests     |
| POST   | /pairing/approve     | Approve a pairing code            |
| GET    | /agent/conversations | List active AI conversations      |

## pairing list

Shows pending pairing requests.

```bash
closeclaw pairing list
```

## pairing approve

Approves a pairing request by code.

```bash
closeclaw pairing approve <code>
```

## agent configure

Interactive AI provider and model setup.

```bash
closeclaw agent configure
```

**Behavior:**

- If an agent is already configured, asks whether to reconfigure
- Prompts for provider, then shows a list of popular models for
  that provider with a "Custom (enter manually)" option
- Collects API key (skipped for Ollama)
- Collects base URL for Ollama and custom providers
- Optionally enables tool calling with tool selection
- Validates the configuration by making a test API call
- Saves to `~/.closeclaw/config.json` under the `agent` key

**Supported Providers:**

| Provider  | Models                                       | Auth         |
| --------- | -------------------------------------------- | ------------ |
| OpenAI    | gpt-5.4, gpt-5.4-pro, gpt-5.4-mini, etc.     | API key      |
| Anthropic | claude-opus-4-6, claude-sonnet-4-6, etc.     | API key      |
| Google    | gemini-3.1-pro-preview, gemini-2.5-pro, etc. | API key      |
| Ollama    | llama4, llama3.3, deepseek-r1, etc.          | None (local) |
| Kimi      | kimi-k2.5, kimi-k2-thinking, kimi-code, etc. | API key      |
| Custom    | Any OpenAI-compatible model                  | Optional     |

## agent system-prompt

View or update the AI agent's system prompt.

```bash
closeclaw agent system-prompt
```

## agent conversations

List active AI conversations.

```bash
closeclaw agent conversations
```

## cron list

Display all scheduled tasks.

```bash
closeclaw cron list
```

Shows a table with ID, Name, Type, Status, Runs, and Schedule columns.

## cron add

Create a new scheduled task.

```bash
closeclaw cron add --name "Daily standup" --message "summarize open issues" --cron "0 9 * * *"
closeclaw cron add --name "Remind" --message "check inbox" --at 30m
closeclaw cron add --name "CI check" --message "run tests" --every 2h
```

**Options:**

| Flag                | Description                         |
| ------------------- | ----------------------------------- |
| `--name <name>`     | Task name (required)                |
| `--message <msg>`   | Prompt sent to the AI agent         |
| `--at <duration>`   | One-shot delay (e.g. 30m, 1h, 1d)   |
| `--every <dur>`     | Recurring interval (e.g. 2h, 30m)   |
| `--cron <expr>`     | Cron expression (e.g. `0 9 * * *`)  |
| `--tz <timezone>`   | Timezone for cron (e.g. UTC)        |
| `--platform <plat>` | Target platform (default: telegram) |
| `--sender-id <id>`  | Target sender ID (default: default) |

Exactly one of `--at`, `--every`, or `--cron` must be specified.

## cron remove

Remove a scheduled task by ID.

```bash
closeclaw cron remove <task-id>
```

## cron runs

View run history for a specific task.

```bash
closeclaw cron runs <task-id>
```

## heartbeat configure

Interactive heartbeat schedule setup.

```bash
closeclaw heartbeat configure
```

**Behavior:**

- Prompts for heartbeat interval (e.g. 30m, 1h)
- Optionally sets active hours (start/end times)
- Selects delivery target: last sender or silent
- Saves heartbeat configuration to `~/.closeclaw/config.json`

## heartbeat status

Display current heartbeat configuration.

```bash
closeclaw heartbeat status
```

Shows whether heartbeat is enabled, the interval, target, active hours, and timezone.
