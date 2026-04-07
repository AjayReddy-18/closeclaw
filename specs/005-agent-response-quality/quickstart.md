# Quickstart: Agent Response Quality

## What This Feature Does

1. **Telegram formatting**: AI responses are automatically converted from markdown to Telegram HTML, so bold text, code blocks, links, and lists render properly instead of showing raw `**`, `#`, and `` ` `` symbols.

2. **Smart suppression**: When you ask the agent to monitor something in the background, it only notifies you when the task is done or something important changes — no more "still running" spam every 5 minutes.

3. **Better AI behavior**: The agent now has built-in guidance to be concise, use tools proactively, and format responses appropriately for your messaging platform.

## How to Verify

### Formatting

Start the gateway and send a message that triggers a formatted response:

```bash
pnpm closeclaw gateway start
```

Then in Telegram, ask something like:
- "Give me a code example in Python"
- "Compare pros and cons of REST vs GraphQL"
- "List my open Jira issues"

Responses should render with proper bold, italic, code blocks, and bullet points.

### Suppression

Schedule a monitoring task:

```
Monitor my Jenkins build #123 and tell me when it finishes
```

The agent will poll periodically but only message you when:
- The build finishes (success or failure)
- Something significant changes
- 30 minutes pass with no update (safety check)

### Prompt Quality

Ask simple questions and notice:
- Short questions get short answers (1-3 sentences)
- The agent uses tools instead of guessing (e.g., uses datetime tool for "what time is it?")
- No "Great question!" or "I'd be happy to help!" filler

## Configuration

The built-in system prompt works out of the box. Your custom system prompt (if set via `closeclaw agent system-prompt`) is prepended as additional owner instructions.

Response verbosity can be adjusted in conversation:
- "Keep your answers short" — agent remembers and stays concise
- "Give me detailed explanations" — agent provides more depth
