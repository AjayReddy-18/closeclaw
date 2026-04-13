# Feature Specification: Live Progress Streaming

**Feature Branch**: `009-live-progress-streaming`
**Created**: 2026-04-13
**Status**: Draft
**Input**: User description: "Improve bot UX by using live-updating messages instead of sending multiple separate progress messages. Edit a single message in-place as progress events arrive (rolling current step), then replace with the final result. Apply to all bot responses: AI thinking, tool calls, Cursor delegation, and scheduled tasks."

## User Scenarios & Testing

### User Story 1 - Live Cursor Delegation Progress (Priority: P1)

When a user asks the bot to delegate a coding task to Cursor, instead of receiving 5-10 separate messages ("Writing package.json", "Running npm install", etc.), the user sees a single message that updates in real-time. The message shows only the current step and replaces itself as each new step begins. When the task finishes, the progress message is replaced with the final structured summary.

**Why this priority**: Cursor delegation generates the most progress messages today (often 5-10+ per task), making it the highest-impact area for UX improvement.

**Independent Test**: Can be tested by asking the bot to delegate a coding task and verifying that progress appears as edits to one message, not as separate messages.

**Acceptance Scenarios**:

1. **Given** a user asks the bot to build a project via Cursor, **When** Cursor starts working, **Then** the user sees a single message that updates in-place showing the current step (e.g., "Writing package.json").
2. **Given** Cursor finishes multiple steps, **When** the next step begins, **Then** the previous step text is replaced with the new step (rolling update, not accumulating).
3. **Given** Cursor completes the task, **When** the final result is ready, **Then** the progress message is replaced with the structured completion summary.
4. **Given** the final summary exceeds the platform message limit, **When** delivered, **Then** the progress message is replaced with the first part and additional parts are sent as new messages.

---

### User Story 2 - Live AI Thinking Indicator (Priority: P2)

When the user sends a message and the AI is processing, instead of the current separate "Processing your message..." notification, the bot sends a single status message that updates through stages: "Thinking..." then "Using tool: datetime" then the final AI response replaces it entirely.

**Why this priority**: Every single message triggers the AI processing flow, so this improves the base experience for all interactions.

**Independent Test**: Can be tested by sending any message to the bot and verifying that a single live-updating message appears during processing and is replaced with the final response.

**Acceptance Scenarios**:

1. **Given** a user sends a message, **When** the AI begins processing, **Then** a single "Thinking..." message appears.
2. **Given** the AI calls a tool during processing, **When** the tool call starts, **Then** the same message updates to show the tool being used (e.g., "Using tool: http_request").
3. **Given** the AI finishes processing, **When** the response is ready, **Then** the thinking message is replaced with the final AI response.
4. **Given** the AI response is short enough for one message, **When** delivered, **Then** only one message exists in the chat (no leftover "Thinking..." message).

---

### User Story 3 - Live Scheduled Task Feedback (Priority: P3)

When a scheduled task fires and produces a result that should be delivered to the user, the delivery follows the same live-updating pattern instead of sending a bare result message.

**Why this priority**: Scheduled tasks run less frequently than interactive messages, but consistent UX across all response types matters.

**Independent Test**: Can be tested by creating a one-shot scheduled task and verifying the delivery uses an updating message.

**Acceptance Scenarios**:

1. **Given** a scheduled task fires, **When** the AI processes the scheduled prompt, **Then** a status message appears and updates through processing stages.
2. **Given** the scheduled task completes, **When** the result is delivered, **Then** the status message is replaced with the final result.

---

### Edge Cases

- What happens when the platform API rate-limits message edits? The system should throttle edits and fall back to the current behavior (separate messages) if editing fails.
- What happens when the bot tries to edit a message that was deleted by the user? The system should catch the error and send a new message instead.
- What happens when the AI response is empty or the tool produces no output? The thinking message should be replaced with the standard error/fallback message.
- What happens when multiple progress events arrive faster than the edit throttle? Only the latest event should be shown (intermediate events are skipped).
- What happens during Cursor approval flow? The approval message with buttons should be sent as a new message (not an edit of the progress message), since the user needs to interact with it.

## Requirements

### Functional Requirements

- **FR-001**: System MUST support editing an existing message in-place on Telegram using the platform's edit message API.
- **FR-002**: System MUST maintain a "live message" handle per active response so that progress updates edit the same message rather than creating new ones.
- **FR-003**: System MUST throttle message edits to avoid platform rate limits (minimum interval between edits).
- **FR-004**: System MUST replace the progress message with the final response when processing completes.
- **FR-005**: System MUST fall back to sending a new message if editing fails (message deleted, API error, etc.).
- **FR-006**: System MUST show only the current/latest progress step in the live message (rolling style, not accumulating).
- **FR-007**: System MUST apply live progress behavior to all response types: AI processing, tool calls, Cursor delegation, and scheduled task delivery.
- **FR-008**: System MUST send approval prompts (Cursor permission buttons) as separate new messages, not as edits to the progress message.
- **FR-009**: System MUST handle the case where the final response is longer than the platform message limit by replacing the progress message with the first chunk and sending remaining chunks as new messages.
- **FR-010**: System MUST skip intermediate progress events that arrive between throttle intervals, showing only the most recent event.

### Key Entities

- **LiveMessage**: Represents a message sent to the user that can be updated in-place. Contains the platform message ID needed for editing.
- **ProgressSession**: Tracks the state of an active response being streamed to the user — the current live message handle, throttle timer, and whether the session is still active.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A Cursor delegation task that previously generated 5+ separate messages now produces at most 2 messages (one live-updating progress + one final summary, or just the final summary if it fits in one message).
- **SC-002**: Users see the current progress step within 3 seconds of it occurring (respecting throttle limits).
- **SC-003**: The final AI response replaces the progress indicator in every successful interaction — no orphaned "Thinking..." messages remain.
- **SC-004**: If message editing fails, the user still receives the response via a new message within 2 seconds of the failure.
- **SC-005**: All existing test coverage is maintained at 90%+ after implementation.

## Assumptions

- Telegram's `editMessageText` API is available and supports editing bot-sent messages (confirmed: grammY supports this).
- Discord also supports message editing via its API (Discord.js `message.edit()`), so the same pattern can apply.
- Platform rate limits for message editing are manageable with a reasonable throttle interval (Telegram allows ~30 edits per minute per chat).
- The existing `onProgress` callback pattern in the codebase can be adapted to edit messages instead of sending new ones.
- Cursor approval flow (inline keyboard buttons) remains as separate messages since users need to interact with them.
