# CloseClaw

An automation tool that connects AI models to messaging platforms like Telegram and Discord — enabling intelligent bot interactions with tool calling, scheduled tasks, MCP integration, and Cursor CLI delegation.

## Features

- **Bot Integration** — Connect to Telegram or Discord with pairing-based access control
- **AI Agent Routing** — Route messages through OpenAI, Anthropic, Google, Ollama, Kimi, or any OpenAI-compatible provider
- **Tool Calling** — Built-in tools (datetime, HTTP requests, shell execution) plus MCP server tools
- **Persistent Conversations** — Per-sender conversation history with automatic compression and preference memory
- **Scheduled Automation** — Cron jobs, one-shot tasks, recurring intervals, and smart response suppression
- **MCP Tool Integration** — Discover and use tools from external MCP servers (Jira, Confluence, Datadog, etc.)
- **Cursor CLI Delegation** — Delegate coding tasks to Cursor's headless agent with real-time progress and interactive approval
- **Live Progress Streaming** — Single live-updating message per response instead of multiple progress notifications
- **Network Resilience** — DNS-over-HTTPS for reliable connectivity behind VPNs

## Prerequisites

- **Node.js** 22 LTS or later
- **pnpm** 10+
- A **Telegram** or **Discord** bot token
- An API key for your chosen AI provider (not needed for Ollama)

Optional:

- **Cursor CLI** (`cursor-agent`) for coding task delegation
- MCP servers for external tool integration

## Installation

```bash
git clone <repo-url> closeclaw
cd closeclaw
pnpm install
pnpm build
```

## Quick Start

### 1. Onboard a Bot

```bash
pnpm closeclaw onboard
```

The wizard walks you through:

- Choosing a platform (Telegram or Discord)
- Creating a bot and entering its token
- Selecting a DM access policy (pairing, allowlist, or open)

### 2. Configure an AI Agent

```bash
pnpm closeclaw agent configure
```

Select a provider, model, API key, and which tools to enable.

**Supported Providers:**

| Provider  | Example Models                         | Auth         |
| --------- | -------------------------------------- | ------------ |
| Anthropic | claude-opus-4-6, claude-sonnet-4-6     | API key      |
| OpenAI    | gpt-5.4, gpt-5.4-pro, gpt-5.4-mini     | API key      |
| Google    | gemini-3.1-pro-preview, gemini-2.5-pro | API key      |
| Ollama    | llama4, llama3.3, deepseek-r1          | None (local) |
| Kimi      | kimi-k2.5, kimi-k2-thinking            | API key      |
| Custom    | Any OpenAI-compatible model            | Optional     |

### 3. Start the Gateway

```bash
pnpm closeclaw gateway start
```

The gateway connects your bot, starts the HTTP server, loads MCP tools, and begins processing messages. Press `Ctrl+C` to stop.

## CLI Reference

All commands run via `pnpm closeclaw <command>` (or `closeclaw <command>` if globally linked).

### Bot Setup

| Command                  | Description                   |
| ------------------------ | ----------------------------- |
| `onboard`                | Interactive bot setup wizard  |
| `pairing list`           | Show pending pairing requests |
| `pairing approve <code>` | Approve a pairing request     |

### Gateway

| Command         | Description                    |
| --------------- | ------------------------------ |
| `gateway start` | Start the gateway (foreground) |

### AI Agent

| Command               | Description                         |
| --------------------- | ----------------------------------- |
| `agent configure`     | Interactive AI provider/model setup |
| `agent system-prompt` | View or edit the system prompt      |
| `agent conversations` | List active conversations           |

### Scheduled Tasks

| Command               | Description                                    |
| --------------------- | ---------------------------------------------- |
| `cron list`           | List all scheduled tasks                       |
| `cron add`            | Create a task (`--at`, `--every`, or `--cron`) |
| `cron remove <id>`    | Delete a task                                  |
| `cron runs <id>`      | View run history                               |
| `heartbeat configure` | Set up periodic heartbeat                      |
| `heartbeat status`    | View heartbeat configuration                   |

### MCP Servers

| Command             | Description                     |
| ------------------- | ------------------------------- |
| `mcp add <name>`    | Add an MCP server (interactive) |
| `mcp remove <name>` | Remove an MCP server            |
| `mcp list`          | List configured servers         |
| `mcp status`        | Check server connectivity       |

### Cursor Agent

| Command           | Description                     |
| ----------------- | ------------------------------- |
| `cursor sessions` | List recent Cursor CLI sessions |

## Configuration

All configuration lives in `~/.closeclaw/`:

| File              | Purpose                                           |
| ----------------- | ------------------------------------------------- |
| `config.json`     | Main config: channels, gateway, agent, heartbeat  |
| `mcp.json`        | MCP server definitions (Cursor-compatible format) |
| `pairing.json`    | Pairing request store                             |
| `conversations/`  | Per-sender conversation history                   |
| `preferences/`    | Per-sender preference memory                      |
| `cron/tasks.json` | Scheduled tasks and run history                   |
| `HEARTBEAT.md`    | Free-form checklist for heartbeat prompts         |

Edit `config.json` directly for advanced configuration.

## MCP Server Configuration

Configure external tool servers in `~/.closeclaw/mcp.json`:

```json
{
  "mcpServers": {
    "jira": {
      "type": "http",
      "url": "http://localhost:8000/mcp",
      "headers": {
        "Authorization": "Token ${env:MCP_JIRA_TOKEN}"
      }
    },
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    }
  }
}
```

Environment variables are interpolated with `${env:VAR_NAME}` syntax. Add `"enabled": false` to temporarily disable a server.

## Cursor CLI Delegation

When the bot receives a coding task, it can delegate to Cursor's headless agent:

**Interactive mode (default):** Cursor runs without `--force`. If it needs to run a risky operation (like `npm install`), it gets rejected — CloseClaw detects the rejection, asks you for approval via Telegram, and resumes the session with `--force` if you accept.

**Trust mode (explicit):** Cursor runs with `--force` and auto-approves everything. Use only when you explicitly say "trust mode."

Real-time progress updates (file writes, commands, AI messages) are streamed to Telegram as they happen.

**Requirements:**

```bash
cursor-agent -v    # must be installed and authenticated
```

## Architecture

```
packages/
  cli/            # CLI commands and gateway orchestration
  gateway/        # HTTP server, message routing, DM policy
  bot-adapters/   # Telegram and Discord adapters
  ai-agent/       # AI model invocation, tools, conversation management
  cursor-agent/   # Cursor CLI spawning, PTY runner, session management
  mcp-client/     # MCP server connection and tool discovery
  shared-types/   # Configuration types, enums, validators
```

The project is a **pnpm monorepo**. Each package is independently buildable and testable.

## Development

```bash
pnpm install          # install dependencies
pnpm build            # build all packages
pnpm test             # run all tests
pnpm test:coverage    # run with coverage report
pnpm lint             # lint with oxlint
pnpm format           # format with prettier
pnpm format:check     # check formatting
```

### Tech Stack

- **TypeScript 5.x** (strict mode)
- **Node.js 22 LTS**
- **pnpm** monorepo
- **Vitest** for testing (90% coverage threshold)
- **oxlint** + **Prettier** for linting and formatting
- **Vercel AI SDK** for model integration
- **grammY** for Telegram
- **Commander.js** for CLI
- **node-pty** for Cursor CLI PTY integration

## Gateway Endpoints

When the gateway is running:

| Method | Path                   | Description                |
| ------ | ---------------------- | -------------------------- |
| `GET`  | `/health`              | Gateway and adapter health |
| `GET`  | `/pairing/pending`     | Pending pairing requests   |
| `POST` | `/pairing/approve`     | Approve a pairing code     |
| `GET`  | `/agent/conversations` | Active AI conversations    |

## DM Access Policies

| Policy                | Behavior                                            |
| --------------------- | --------------------------------------------------- |
| **Pairing** (default) | Unknown senders get a pairing code; approve via CLI |
| **Allowlist**         | Only pre-configured sender IDs can interact         |
| **Open**              | Anyone can message (shows security warning)         |

## Troubleshooting

**Gateway won't connect on VPN:**
CloseClaw uses DNS-over-HTTPS (Google DNS) to resolve API hostnames. If connections still fail, try starting the gateway before connecting to VPN.

**Cursor agent exits with "code 1 and no output":**
The target project directory may not exist. CloseClaw auto-creates it, but verify `cursor-agent -v` works in your terminal.

**MCP server shows "failed" on startup:**
Check that the server is running and accessible. For HTTP servers, verify the URL and auth headers. Missing `${env:VAR}` values produce warnings.

**Bot not responding to messages:**
Verify the gateway is running (`pnpm closeclaw gateway start`) and your sender is approved (check `pnpm closeclaw pairing list`).

## Documentation

Detailed docs for each feature are in the `docs/` directory:

- [Getting Started](docs/getting-started.md)
- [Bot Onboarding](docs/bot-onboarding.md)
- [AI Agent](docs/ai-agent.md)
- [CLI Reference](docs/cli-reference.md)
- [Scheduled Automation](docs/scheduled-automation.md)
- [Response Formatting](docs/response-formatting.md)
- [MCP Integration](docs/mcp-integration.md)
- [Cursor Agent](docs/cursor-agent.md)
- [Live Progress](docs/live-progress.md)

## License

Private — not published.
