# Research: Live Progress Streaming

## Phase 0 — Unknowns & Decisions

### R-001: Telegram editMessageText API Behavior

**Decision**: Use `bot.api.editMessageText(chatId, messageId, newText, { parse_mode })` from grammY.
**Rationale**: grammY wraps the full Telegram Bot API. `sendMessage` returns a `Message` object with a numeric `message_id`. This ID is passed to `editMessageText` for in-place edits. Parse mode must match the original or Telegram rejects the edit. If the text hasn't changed, Telegram returns `400: message is not modified` — must catch and ignore.
**Alternatives considered**: Deleting + re-sending (bad UX — causes notification flash), inline query editing (not applicable to DMs).

### R-002: Telegram Rate Limits for Edits

**Decision**: Throttle edits to a minimum of 2-second intervals per chat.
**Rationale**: Telegram allows ~30 messages/second globally, but per-chat limits are stricter (~1 edit per second safely, burst up to 3). A 2-second throttle provides safety margin while keeping UX responsive. The existing `PROGRESS_THROTTLE_MS = 3_000` in cursor-agent already respects this.
**Alternatives considered**: 1-second throttle (too aggressive for sustained tool call bursts), 5-second throttle (too sluggish for UX).

### R-003: Discord Message Editing

**Decision**: Use `Message.edit(newContent)` from Discord.js. The `sendMessage` in DiscordAdapter must return the sent `Message` object (or at minimum its ID + channel ID).
**Rationale**: Discord.js supports editing messages the bot has sent. The current `DiscordAdapter.sendMessage` uses `user.send(text)` which returns a `Message` — we just need to propagate the return value.
**Alternatives considered**: Channel fetch + message edit by ID (more complex, same result).

### R-004: Where to Place LiveMessage Abstraction

**Decision**: New module `packages/bot-adapters/src/live-message.ts` providing a `LiveMessage` class/interface. The adapter interface gains `editMessage` and a modified `sendMessage` that returns a message handle.
**Rationale**: The live-message logic (throttling, fallback, state tracking) is platform-agnostic. By keeping it in `bot-adapters`, both `gateway` and `cli` can use it without circular dependencies. The adapter interface must be extended (not replaced) so existing code stays compatible.
**Alternatives considered**: Putting it in `gateway` (creates coupling), putting it in a new `packages/live-progress` package (YAGNI — this is adapter-level behavior).

### R-005: How to Wire Live Updates into the Agent Flow

**Decision**: Replace the current `progressRef.send(text)` pattern with a `LiveMessage` handle that is created per-response and passed through the same `progressRef`-style object. The `runAgentResponse` function creates a `LiveMessage` at start ("Thinking..."), passes its `.update(text)` as the progress callback, and calls `.finalize(finalText)` when the response is ready.
**Rationale**: This is the minimal change surface. The existing callback signatures (`onProgress: (text: string) => void`, `onIntermediate`) already accept text strings — they just need to call `liveMessage.update()` instead of `adapter.sendMessage()`.
**Alternatives considered**: Event emitter pattern (heavier), reactive streams (YAGNI).

### R-006: Handling Final Response Replacement

**Decision**: When the AI response is ready, call `liveMessage.finalize(text)` which edits the live message with the final text. If the final text exceeds the platform limit, it edits with the first chunk and sends remaining chunks as new messages.
**Rationale**: Keeps the chat clean — one progress message becomes the final answer. Split handling reuses the existing `splitMessage` utility.
**Alternatives considered**: Always delete progress + send new (causes notification, bad UX).

### R-007: Scheduler Delivery Integration

**Decision**: The scheduler's `deliver` function gains an optional `createLiveMessage` parameter. When available, it creates a live message, shows "Running scheduled task...", updates through processing, and finalizes with the result.
**Rationale**: Consistent UX across all response types (FR-007). The scheduler currently calls `adapter.sendMessage` directly — adding live-message support follows the same pattern as the interactive flow.
**Alternatives considered**: No live updates for scheduled tasks (inconsistent UX, violates FR-007).
