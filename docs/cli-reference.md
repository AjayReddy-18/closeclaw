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

| Policy | Description |
|--------|-------------|
| pairing | Default. Unapproved senders receive a pairing code to approve via CLI |
| allowlist | Only pre-approved sender IDs can message the bot |
| open | Anyone can message (shows security warning) |

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

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Gateway and adapter health status |
| GET | /pairing/pending | List pending pairing requests |
| POST | /pairing/approve | Approve a pairing code |
| GET | /agent/conversations | List active AI conversations |

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

| Provider | Models | Auth |
|----------|--------|------|
| OpenAI | gpt-5.4, gpt-5.4-pro, gpt-5.4-mini, etc. | API key |
| Anthropic | claude-opus-4-6, claude-sonnet-4-6, etc. | API key |
| Google | gemini-3.1-pro-preview, gemini-2.5-pro, etc. | API key |
| Ollama | llama4, llama3.3, deepseek-r1, etc. | None (local) |
| Kimi | kimi-k2.5, kimi-k2-thinking, kimi-code, etc. | API key |
| Custom | Any OpenAI-compatible model | Optional |

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
