# Getting Started

CloseClaw is an automation tool that connects AI models to messaging
platforms like Telegram and Discord, enabling intelligent bot
interactions with tool-calling capabilities.

## Prerequisites

- Node.js 22 LTS or later
- pnpm 10+
- A Telegram or Discord bot token

## Installation

```bash
git clone <repo-url> closeclaw
cd closeclaw
pnpm install
```

## Quick Setup

### 1. Onboard a Bot

Run the onboard wizard to connect your first bot platform:

```bash
pnpm tsx packages/cli/src/index.ts onboard
```

The wizard guides you through:

- Choosing a platform (Telegram or Discord)
- Step-by-step bot creation instructions
- Entering your bot token
- Selecting a DM access policy (pairing, allowlist, or open)
- Auto-configuring the local gateway

Configuration is saved to `~/.closeclaw/config.json`.

### 2. Configure an AI Agent

Set up an AI model to process messages:

```bash
pnpm tsx packages/cli/src/index.ts agent configure
```

You will select:

- An AI provider (OpenAI, Anthropic, Google, Ollama, Kimi, or custom)
- A model from a list of popular options
- Your API key
- Which tools to enable (datetime, http_request, shell_execute)

### 3. Start the Gateway

Launch the gateway to begin processing messages:

```bash
pnpm tsx packages/cli/src/index.ts gateway start
```

The gateway connects your bot adapters, starts the HTTP server, and
routes incoming messages through the AI agent. Press Ctrl+C to stop.

## What Happens Next

Once running, users can message your bot on Telegram or Discord.
Messages from approved senders are processed by the configured AI
model, which can use tools to fetch data, make HTTP requests, or
run shell commands before responding.

See [CLI Reference](./cli-reference.md) for all available commands
and [AI Agent](./ai-agent.md) for model and tool configuration.
