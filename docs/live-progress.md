# Live Progress Streaming

CloseClaw sends bot responses as live-updating messages instead of separate progress notifications.

## How It Works

When you send a message to the bot, a single "Thinking..." message appears. As the AI processes your request, that same message updates in-place to show what's happening:

```
Thinking... → Using tool: http_request → Writing package.json → Final response
```

The final AI response replaces the progress message entirely. You only see one clean message in the chat — no leftover "Thinking..." or "Processing..." artifacts.

## Supported Platforms

| Platform | Edit Support | Behavior                                       |
| -------- | ------------ | ---------------------------------------------- |
| Telegram | Yes          | Messages edited in-place via `editMessageText` |
| Discord  | Yes          | Messages edited in-place via `Message.edit()`  |

## What Gets Live Updates

- **AI Thinking**: "Thinking..." updates to tool names, then replaced with the final answer.
- **Cursor Delegation**: Rolling progress shows current step ("Writing file...", "Running command..."), replaced with the task summary.
- **Scheduled Tasks**: "Running scheduled task..." replaced with the final result.
- **Approval Prompts**: Accept/Deny buttons appear as separate messages (not edits) so you can interact with them.

## Throttling

To respect platform rate limits, message edits are throttled to a minimum 2-second interval. If multiple progress events arrive within that window, only the latest one is shown.

## Fallback Behavior

If message editing fails for any reason (message deleted by user, API error, platform doesn't support editing), CloseClaw automatically falls back to sending new messages — the same behavior as before this feature. No configuration needed.

## Message Splitting

When the final response is too long for a single message (Telegram limit: 4096 characters), the progress message is replaced with the first chunk and remaining chunks are sent as new messages.

## Configuration

No configuration required. Live progress streaming is enabled automatically when the bot platform supports message editing.
