# Quickstart: Live Progress Streaming

## What Changes

Before this feature, every progress update (AI thinking, Cursor steps, tool calls) was sent as a separate Telegram/Discord message. After this feature, a single message is sent and edited in-place with rolling progress, then replaced with the final result.

## How It Works

1. User sends a message to the bot.
2. Bot sends a single "Thinking..." message.
3. As the AI calls tools or delegates to Cursor, the same message updates in-place: "Using tool: http_request" → "Writing package.json" → "Running npm install".
4. When the AI finishes, the message is replaced with the final response.
5. If the response is too long, the message becomes the first chunk and additional chunks follow as new messages.

## Key Files to Touch

| Package        | File                              | Change                                                          |
| -------------- | --------------------------------- | --------------------------------------------------------------- |
| `bot-adapters` | `src/adapter.ts`                  | Add `editMessage`, `SendResult` type                            |
| `bot-adapters` | `src/telegram-adapter.ts`         | Implement `editMessage`, return `SendResult` from `sendMessage` |
| `bot-adapters` | `src/discord-adapter.ts`          | Implement `editMessage`, return `SendResult` from `sendMessage` |
| `bot-adapters` | `src/live-message.ts`             | **NEW** — `createLiveMessage` factory                           |
| `gateway`      | `src/gateway-agent-handler.ts`    | Use `LiveMessage` in `runAgentResponse`                         |
| `cli`          | `src/commands/scheduler-setup.ts` | Use `LiveMessage` for scheduled task delivery                   |
| `cursor-agent` | (no changes)                      | `onProgress` callback signature unchanged                       |
| `ai-agent`     | (no changes)                      | `onIntermediate` callback signature unchanged                   |

## Verification

```bash
# Run all tests
pnpm test

# Start gateway and send a message via Telegram
pnpm closeclaw gateway start

# Verify: only one message appears during processing, updated in-place
# Verify: final response replaces the progress message
# Verify: Cursor delegation shows rolling step updates in one message
```

## Rollback

If live editing causes issues, the fallback behavior (sending new messages) activates automatically when `editMessage` returns `false`. To fully disable, remove the `editMessage` method from the adapter — the `LiveMessage` module gracefully degrades.
