# Data Model: Live Progress Streaming

## Entities

### LiveMessageHandle

Represents a bot-sent message that can be updated in-place.

| Field     | Type                | Description                               |
| --------- | ------------------- | ----------------------------------------- |
| chatId    | string              | Platform chat/user ID                     |
| messageId | number \| string    | Platform-specific message ID for editing  |
| parseMode | "HTML" \| undefined | Parse mode used when the message was sent |

### ProgressSession

Tracks the state of an active live-progress response.

| Field         | Type                      | Description                                          |
| ------------- | ------------------------- | ---------------------------------------------------- |
| liveMessage   | LiveMessageHandle \| null | Current message being edited, null before first send |
| lastEditAt    | number                    | Timestamp of last successful edit (for throttling)   |
| pendingText   | string \| null            | Queued text waiting for throttle window              |
| throttleTimer | NodeJS.Timeout \| null    | Timer for next throttled edit                        |
| active        | boolean                   | Whether the session is still accepting updates       |

### SendResult

Return value from adapter's sendMessage, providing the handle needed for edits.

| Field     | Type             | Description                  |
| --------- | ---------------- | ---------------------------- |
| messageId | number \| string | Platform-assigned message ID |

## Interface Changes

### BotAdapter (extended)

```text
editMessage?(chatId: string, messageId: number | string, text: string, options?: SendMessageOptions): Promise<boolean>;
sendMessage(senderId: string, text: string, options?: SendMessageOptions): Promise<SendResult | void>;
```

- `editMessage` returns `true` if edit succeeded, `false` if it failed (message deleted, API error).
- `sendMessage` return type changes from `Promise<void>` to `Promise<SendResult | void>` for backward compatibility — adapters that support live messages return `SendResult`.

### IntermediateResponseFn (unchanged)

```text
type IntermediateResponseFn = (text: string) => Promise<void>;
```

The callback's implementation changes internally (calls `liveMessage.update()` instead of `adapter.sendMessage()`), but its signature stays the same.

## State Transitions

```text
ProgressSession lifecycle:
  CREATED → FIRST_SEND → UPDATING → FINALIZED
     │                       │           │
     └── (error) ────────────┘           │
                  FALLBACK_NEW_MSG ──────┘
```

1. **CREATED**: Session initialized, no message sent yet.
2. **FIRST_SEND**: Initial "Thinking..." or "Delegating to Cursor..." sent, `liveMessage` populated.
3. **UPDATING**: Progress events edit the live message (throttled).
4. **FINALIZED**: Final response replaces the live message content. Session deactivated.
5. **FALLBACK_NEW_MSG**: If any edit fails, session falls back to sending new messages for remaining updates.
