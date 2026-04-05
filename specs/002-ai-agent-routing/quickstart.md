# Quickstart: AI Agent Routing

**Feature**: 002-ai-agent-routing
**Branch**: `002-ai-agent-routing`

## Prerequisites

- Feature 001 (`closeclaw onboard`) complete — at least one bot configured
- Node.js 22 LTS installed
- pnpm 10.x installed
- For local AI: Ollama running (`ollama serve`) with a model pulled (e.g., `ollama pull llama3.2`)
- For cloud AI: API key from your chosen provider (OpenAI, Anthropic, Google, Kimi)

## Setup

### 1. Switch to the feature branch

```bash
git checkout -b 002-ai-agent-routing
```

### 2. Install new dependencies

```bash
pnpm install
```

New packages added by this feature:

- `ai` — Vercel AI SDK core
- `@ai-sdk/openai` — OpenAI + OpenAI-compatible providers (also covers Ollama, Kimi, custom)
- `@ai-sdk/anthropic` — Anthropic Claude provider
- `@ai-sdk/google` — Google Gemini provider
- `zod` — Schema validation for tool definitions (AI SDK peer dependency)

### 3. Verify the build

```bash
pnpm build
```

### 4. Run the test suite

```bash
pnpm test
```

### 5. Run with coverage

```bash
pnpm test:coverage
```

All metrics must be >= 90%.

## Validation Steps

### Step 1: Configure an AI agent (local with Ollama)

```bash
# Ensure Ollama is running
ollama serve &

# Pull a model if you haven't
ollama pull llama3.2

# Configure the agent
pnpm tsx packages/cli/src/index.ts agent configure
```

Expected prompts:

1. Select provider → **Ollama (Local)**
2. Ollama server URL → **http://localhost:11434** (default)
3. Select model → choose from list: **llama3.2**, llama3.1, mistral, codellama, gemma2, phi3, deepseek-r1, Custom (enter manually)
4. Enable tool calling? → **Yes**
5. Enable shell execution? → **No** (or Yes with warning acknowledgment)

Expected output: "AI agent configured successfully! Provider: ollama, Model: llama3.2"

### Step 2: Verify configuration saved

```bash
cat ~/.closeclaw/closeclaw.json | python3 -m json.tool
```

Expected: `agent` section present with provider, model, baseUrl, tools.

### Step 3: Set a system prompt

```bash
pnpm tsx packages/cli/src/index.ts agent system-prompt
```

Enter a prompt like: "You are a helpful DevOps assistant. Help with shell commands and infrastructure questions."

### Step 4: Start the gateway

```bash
pnpm tsx packages/cli/src/index.ts gateway start
```

Expected log output:

```
Gateway listening on 127.0.0.1:7337
AI agent active: ollama/llama3.2
Telegram bot connected
```

### Step 5: Send a message to your bot

From Telegram/Discord (as an approved sender), send: "Hello, what can you help me with?"

Expected: The bot shows a typing indicator, then responds with an AI-generated message describing its capabilities.

### Step 6: Test tool calling

Send: "What is the current date and time?"

Expected: The bot invokes the `datetime` tool and responds with the current timestamp.

### Step 7: Test conversation context

Send: "Remember the number 42"
Then send: "What number did I ask you to remember?"

Expected: The bot recalls "42" from conversation history.

### Step 8: Clear conversation

Send: "/clear"

Expected: The bot confirms "Conversation cleared. Starting fresh!"
Send: "What number did I ask you to remember?"
Expected: The bot does not recall 42.

### Step 9: List conversations (as operator)

In a separate terminal:

```bash
pnpm tsx packages/cli/src/index.ts agent conversations
```

Expected: Table showing active conversations with platform, sender ID, message count, last activity.

### Step 10: Verify backward compatibility

Remove the `agent` section from `~/.closeclaw/closeclaw.json` and restart the gateway. Send a message from an approved sender.

Expected: Message is logged (existing behavior), no AI processing occurs, no errors.

## Cloud Provider Validation (optional)

To test with a cloud provider instead of Ollama:

```bash
pnpm tsx packages/cli/src/index.ts agent configure
```

Select OpenAI/Anthropic/Gemini/Kimi, enter your API key, choose a model. The system validates by making a test request. If successful, restart the gateway and repeat steps 5-8.

## Troubleshooting

| Symptom                                     | Likely Cause                             | Fix                                                    |
| ------------------------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| "Cannot connect to Ollama" during configure | Ollama not running                       | Run `ollama serve`                                     |
| "Invalid API key" during configure          | Wrong or expired key                     | Re-enter the correct API key                           |
| Bot doesn't respond after gateway start     | Agent not configured                     | Run `closeclaw agent configure` first                  |
| "AI agent not active" in gateway logs       | No `agent` section in config             | Run `closeclaw agent configure`                        |
| Tool call timeout                           | Shell command or HTTP request took > 30s | Increase `timeoutMs` in config or optimize the command |
| "Max tool call depth exceeded"              | AI in tool-calling loop                  | Adjust `maxCallDepth` or refine system prompt          |
