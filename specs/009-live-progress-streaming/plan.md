# Implementation Plan: Live Progress Streaming

**Branch**: `009-live-progress-streaming` | **Date**: 2026-04-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-live-progress-streaming/spec.md`

## Summary

Replace the current multi-message progress pattern with a single live-updating message per response. A new `LiveMessage` abstraction in `bot-adapters` handles throttled edits and fallback. The `BotAdapter` interface gains an optional `editMessage` method and `sendMessage` returns a message handle. The gateway's `runAgentResponse` creates a `LiveMessage` per turn, wires it as the progress/intermediate callback, and finalizes it with the AI response. Cursor delegation, AI thinking, and scheduled tasks all use the same flow.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: grammY (Telegram), Discord.js (Discord), Vercel AI SDK, node-pty
**Storage**: N/A (no persistent storage changes)
**Testing**: Vitest (unit + integration)
**Target Platform**: Node.js 22 LTS (macOS/Linux)
**Project Type**: CLI tool / monorepo
**Performance Goals**: Progress visible within 2-3 seconds of occurring
**Constraints**: Telegram rate limit ~30 edits/min per chat; 2-second throttle minimum
**Scale/Scope**: Single-user DM bot, 1 active conversation at a time typically

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                 | Status | Notes                                                                                                                |
| ------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| I. TDD                    | PASS   | All new modules get tests first. Coverage target 90%+.                                                               |
| II. Clean Code            | PASS   | `live-message.ts` ≤ 200 lines. No comments. Functions ≤ 20 lines.                                                    |
| III. Design Principles    | PASS   | `LiveMessage` uses composition + DI (deps injected). KISS: minimal new abstractions. YAGNI: only what spec requires. |
| IV. Atomic Commits        | PASS   | Each phase is independently committable and buildable.                                                               |
| V. Automation-First       | PASS   | Feature itself improves automation UX.                                                                               |
| VI. Modular Architecture  | PASS   | `LiveMessage` lives in `bot-adapters`, no circular deps. Adapter interface extended, not replaced.                   |
| VII. Living Documentation | PASS   | `docs/live-progress.md` created as part of delivery.                                                                 |

## Project Structure

### Documentation (this feature)

```text
specs/009-live-progress-streaming/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 quickstart
├── contracts/
│   └── live-message-api.md
└── tasks.md             # Phase 2 task breakdown
```

### Source Code (repository root)

```text
packages/bot-adapters/
├── src/
│   ├── adapter.ts                          # MODIFIED — add editMessage, SendResult
│   ├── telegram-adapter.ts                 # MODIFIED — implement editMessage, return SendResult
│   ├── discord-adapter.ts                  # MODIFIED — implement editMessage, return SendResult
│   ├── live-message.ts                     # NEW — LiveMessage factory + ProgressSession
│   └── index.ts                            # MODIFIED — export LiveMessage types
├── __tests__/
│   ├── live-message.test.ts                # NEW — unit tests for LiveMessage
│   ├── telegram-edit.test.ts               # NEW — TelegramAdapter editMessage tests
│   └── discord-edit.test.ts                # NEW — DiscordAdapter editMessage tests

packages/gateway/
├── src/
│   └── gateway-agent-handler.ts            # MODIFIED — use LiveMessage in runAgentResponse
├── __tests__/
│   └── gateway-agent-handler-live.test.ts  # NEW — live progress integration tests

packages/cli/
├── src/
│   └── commands/
│       ├── gateway-start.ts                # MODIFIED — minor wiring if needed
│       └── scheduler-setup.ts              # MODIFIED — use LiveMessage for delivery

docs/
└── live-progress.md                        # NEW — user-facing documentation
```

**Structure Decision**: No new packages. All changes fit within existing `bot-adapters`, `gateway`, and `cli` packages. The `LiveMessage` abstraction lives in `bot-adapters` since it depends on adapter methods and is used by both `gateway` and `cli`.

## Design Decisions

### D-001: LiveMessage in bot-adapters (not gateway)

The `LiveMessage` module depends on `sendMessage` and `editMessage` — adapter-level concerns. Placing it in `bot-adapters` avoids a gateway→adapter circular dependency and allows `cli` (scheduler delivery) to use it too.

### D-002: Backward-compatible sendMessage return

`sendMessage` changes from `Promise<void>` to `Promise<SendResult | void>`. Existing callers that ignore the return value are unaffected. Only `LiveMessage` inspects the return for `messageId`.

### D-003: edit fallback strategy

If `editMessage` is unavailable (adapter doesn't implement it) or returns `false`, `LiveMessage` degrades to the current behavior: each update sends a new message. This ensures robustness without feature flags.

### D-004: Throttle at LiveMessage level only

The existing `PROGRESS_THROTTLE_MS` in `cursor-agent` remains but is effectively superseded by `LiveMessage`'s throttle (which controls the edit rate). Double-throttling is acceptable since cursor-agent's throttle reduces callback frequency, and `LiveMessage` further coalesces edits.

### D-005: Approval messages bypass LiveMessage

Cursor approval prompts (inline keyboard buttons) are sent as separate new messages via `sendMessageWithButtons`. They are NOT edits to the progress message. The `LiveMessage` remains active and can resume updates after approval.

### D-006: Final response replaces progress message

`finalize(text)` edits the live message with the final response. If the text must be split (platform limit), the edit contains the first chunk and remaining chunks are sent as new messages. This matches FR-009.

## Implementation Phases

### Phase 1: Adapter Foundation (bot-adapters)

**Goal**: Add `editMessage` to the adapter interface and implement it for Telegram and Discord. Create the `LiveMessage` abstraction.

1. **adapter.ts**: Add `SendResult` interface, `editMessage` optional method to `BotAdapter`.
2. **telegram-adapter.ts**: Implement `editMessage` using `bot.api.editMessageText`. Modify `sendMessage` to return `SendResult` (capture message_id from first chunk).
3. **discord-adapter.ts**: Implement `editMessage` using `Message.edit()`. Modify `sendMessage` to return `SendResult`.
4. **live-message.ts**: Implement `createLiveMessage` with throttled edits, fallback, and finalization.
5. **index.ts**: Export new types and factory.
6. **Tests**: Full coverage for `LiveMessage` (throttling, fallback, finalize, dispose), adapter `editMessage` methods.

### Phase 2: Gateway Integration (gateway)

**Goal**: Wire `LiveMessage` into `runAgentResponse` so all interactive responses use live-updating messages.

1. **gateway-agent-handler.ts**: In `runAgentResponse`:
   - Create a `LiveMessage` at the start with initial text "Thinking...".
   - Replace `progressRef.send = (text) => void sendToUser(text)` with `progressRef.send = (text) => liveMessage.update(text)`.
   - Replace `onIntermediate` callback to call `liveMessage.update(text)`.
   - After `processMessage` resolves, call `liveMessage.finalize(response)`.
   - On error, call `liveMessage.finalize(errorMessage)`.
   - Remove the separate "Processing your message..." sends.
2. **Tests**: Verify single-message behavior, edit calls, finalize replacement, error fallback.

### Phase 3: Scheduled Task Integration (cli)

**Goal**: Scheduled task delivery uses `LiveMessage` for consistent UX.

1. **scheduler-setup.ts**: Modify `buildDeliveryFn` to accept an optional `editMessage` from the adapter. When available, create a `LiveMessage`, show "Running scheduled task...", and finalize with the result.
2. **Tests**: Verify scheduled delivery uses edit flow when available, falls back when not.

### Phase 4: Polish & Documentation

**Goal**: Edge cases, documentation, final coverage check.

1. Handle "message not modified" error from Telegram (catch and ignore).
2. Handle race condition where `finalize` is called before first `update` send completes.
3. **docs/live-progress.md**: User-facing documentation.
4. Update `README.md` with the new feature.
5. Run full test suite, verify 90%+ coverage, lint, format.

## Complexity Tracking

No constitution violations requiring justification.

## Post-Phase 1 Constitution Re-Check

| Principle                 | Status | Notes                                                             |
| ------------------------- | ------ | ----------------------------------------------------------------- |
| I. TDD                    | PASS   | Tests written before implementation for each phase.               |
| II. Clean Code            | PASS   | `live-message.ts` estimated ~120 lines. All functions ≤ 20 lines. |
| III. Design Principles    | PASS   | `LiveMessage` uses DI (deps object), composition, no inheritance. |
| IV. Atomic Commits        | PASS   | Each phase produces a working, passing commit.                    |
| V. Automation-First       | PASS   | Reduces notification noise, improves automation UX.               |
| VI. Modular Architecture  | PASS   | No new packages, no circular deps.                                |
| VII. Living Documentation | PASS   | `docs/live-progress.md` planned for Phase 4.                      |
