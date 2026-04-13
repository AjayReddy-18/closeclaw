# Contract: LiveMessage API

## Overview

The `LiveMessage` module provides a platform-agnostic abstraction for sending a bot message and editing it in-place as progress events arrive. It handles throttling, fallback, and finalization.

## Public Interface

### createLiveMessage

```text
createLiveMessage(deps: LiveMessageDeps): LiveMessage
```

**Parameters**:

| Name             | Type                                                                                          | Description                                   |
| ---------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------- |
| deps.sendMessage | (text: string, options?: SendMessageOptions) => Promise<SendResult \| void>                   | Bound adapter sendMessage for the target chat |
| deps.editMessage | (messageId: number \| string, text: string, options?: SendMessageOptions) => Promise<boolean> | Bound adapter editMessage for the target chat |
| deps.throttleMs  | number (default: 2000)                                                                        | Minimum interval between edits                |

**Returns**: `LiveMessage`

### LiveMessage

```text
interface LiveMessage {
  update(text: string): void;
  finalize(text: string, extraChunks?: string[]): Promise<void>;
  dispose(): void;
}
```

| Method                         | Description                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `update(text)`                 | Queue a progress update. If no message exists yet, sends one. Otherwise edits in-place (throttled). Fire-and-forget (no await needed).           |
| `finalize(text, extraChunks?)` | Replace the live message with the final text. If `extraChunks` are provided, they are sent as new messages after the edit. Disposes the session. |
| `dispose()`                    | Clean up timers. Called automatically by `finalize`. Safe to call multiple times.                                                                |

## Adapter Contract Extensions

### BotAdapter.editMessage (optional)

```text
editMessage?(
  chatId: string,
  messageId: number | string,
  text: string,
  options?: SendMessageOptions,
): Promise<boolean>;
```

Returns `true` on success, `false` on failure. Must not throw.

### BotAdapter.sendMessage (extended return)

```text
sendMessage(
  senderId: string,
  text: string,
  options?: SendMessageOptions,
): Promise<SendResult | void>;
```

Where `SendResult = { messageId: number | string }`.

Adapters that do not return `SendResult` cause `LiveMessage` to fall back to sending new messages for every update.

## Error Handling

| Scenario                                | Behavior                                                           |
| --------------------------------------- | ------------------------------------------------------------------ |
| `sendMessage` fails on first send       | `update` retries once, then logs and discards                      |
| `editMessage` returns `false`           | Session enters fallback mode: subsequent updates send new messages |
| `editMessage` throws                    | Caught, treated as `false`                                         |
| `finalize` edit fails                   | Sends final text as a new message                                  |
| Platform returns "message not modified" | Treated as success (text unchanged)                                |
| Throttle timer fires after `dispose`    | No-op, timer already cleared                                       |

## Throttling Behavior

```text
update("Step 1") → sends message (gets messageId)
update("Step 2") at +500ms → queued (throttle 2000ms)
update("Step 3") at +800ms → replaces queued text (only latest kept)
throttle fires at +2000ms → edits message with "Step 3"
update("Step 4") at +2500ms → queued
finalize("Done!") at +2800ms → cancels throttle, edits immediately with "Done!"
```
