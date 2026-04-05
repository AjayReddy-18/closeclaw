# Feature Specification: Persistent Conversation Storage

**Feature Branch**: `003-persistent-memory`
**Created**: 2026-04-05
**Status**: Clarified
**Input**: User description: "Persistent conversation storage with history compression and user preference memory. Save history to ~/.closeclaw. Compress when history piles up so agent doesn't slow down. Store user preferences (likes, dislikes, favourites) separately for personalized responses."

## Clarifications

### Session 2026-04-05

- Q: How does OpenClaw store conversation history? → A: OpenClaw uses a layered Markdown-based memory system: `MEMORY.md` for long-term facts/preferences (loaded every session), daily `memory/YYYY-MM-DD.md` files for running context, and automatic "memory flush" before compaction to prevent context loss. All files live in `~/.openclaw/workspace/`. OpenClaw also supports compaction — summarizing older conversation turns when the context window fills up.
- Q: Should CloseClaw replicate OpenClaw's exact architecture? → A: No. CloseClaw should adopt the best ideas (Markdown files, layered memory, compaction/summarization) but keep it simpler and tailored to CloseClaw's bot-centric architecture where conversations happen per-sender via Telegram/Discord DMs.
- Q: Should preference extraction be automatic or explicit ("remember...")? → A: Automatic — the AI always checks for preference-worthy information in every response. More convenient for users; the slight extra processing per message is acceptable.
- Q: Should compression use the same model or a separate cheaper model? → A: Same model as the agent. Simpler configuration, higher quality summaries. No separate compression model in v1.
- Q: Compression threshold and keep-recent count? → A: Default 50 messages to trigger compression, keep 20 most recent verbatim. Configurable via agent settings.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Conversations Survive Gateway Restarts (Priority: P1)

A user has been chatting with their CloseClaw bot throughout the day. They need to restart the gateway (e.g., to update configuration or after a system reboot). After the restart, they send a follow-up message to the bot. The bot picks up the conversation where it left off, demonstrating awareness of earlier exchanges without the user having to repeat themselves.

**Why this priority**: This is the fundamental value proposition. Currently, all conversation history is lost on restart, which is the single biggest usability gap. Without this, every gateway restart feels like talking to a stranger.

**Independent Test**: Start the gateway, send several messages to build a conversation. Stop the gateway. Start the gateway again. Send a follow-up message referencing something from the earlier conversation. Verify the bot responds with awareness of the prior context.

**Acceptance Scenarios**:

1. **Given** a sender has an active conversation with history, **When** the gateway is stopped and restarted, **Then** the sender's conversation history is fully restored from disk and the next message includes prior context
2. **Given** multiple senders have active conversations, **When** the gateway restarts, **Then** each sender's individual conversation is restored independently and correctly
3. **Given** the gateway starts for the first time with no history files, **When** a sender sends their first message, **Then** a new conversation file is created on disk and the bot responds normally
4. **Given** a conversation is restored from disk, **When** the sender sends "/clear", **Then** the conversation history file is cleared and subsequent messages start fresh

---

### User Story 2 - Automatic History Compression (Priority: P2)

After weeks of use, a sender's conversation history has grown very large. Rather than keeping every single message verbatim (which would slow down AI processing and exceed context windows), the system automatically compresses older portions of the conversation into concise summaries. Recent messages remain intact. The AI still has access to the key facts and decisions from earlier exchanges without the performance penalty of processing thousands of raw messages.

**Why this priority**: Without compression, persistent storage would eventually degrade performance — either by sending too much context to the AI (slow, expensive, may exceed token limits) or by losing old context entirely. Compression ensures the system remains fast and cost-effective long-term.

**Independent Test**: Send enough messages to a sender's conversation to exceed the compression threshold. Verify that older messages are replaced by a summary in the conversation file. Send a new message and verify the AI response time is not degraded. Ask the bot about something mentioned in the compressed portion and verify it can still reference the summarized context.

**Acceptance Scenarios**:

1. **Given** a conversation's raw message count exceeds the configured compression threshold, **When** the next message is processed, **Then** the system compresses older messages into a summary before invoking the AI
2. **Given** a compression is triggered, **When** the summary is generated, **Then** recent messages (within a configurable "keep recent" window) remain verbatim and only older messages are summarized
3. **Given** a conversation has been compressed, **When** the sender asks about something from the compressed portion, **Then** the AI can still reference key facts from the summary
4. **Given** compression is running, **When** the sender sends a new message, **Then** the compression happens in the background and does not block message processing — the sender sees no delay
5. **Given** a conversation has been compressed multiple times, **When** the conversation file is loaded, **Then** the file contains the latest summary followed by the recent verbatim messages

---

### User Story 3 - User Preference Memory (Priority: P3)

When a sender shares personal preferences during conversation — such as "I prefer dark mode", "My timezone is IST", "I like Python over JavaScript", or "My name is Ajay" — the agent recognizes these as durable facts and stores them in a dedicated preference file for that sender. In future conversations, the AI automatically has access to these preferences and can personalize its responses accordingly, even across gateway restarts.

**Why this priority**: Personalization transforms the bot from a generic assistant into one that feels like it "knows" the user. However, it builds on top of persistent storage (US1) and benefits from compression (US2) being in place first.

**Independent Test**: Tell the bot "Remember that my favourite language is TypeScript". Restart the gateway. Ask the bot "What is my favourite language?". Verify the bot responds with "TypeScript" without being reminded.

**Acceptance Scenarios**:

1. **Given** a sender shares a personal preference (e.g., "My timezone is IST"), **When** the AI processes the message, **Then** the preference is extracted and stored in the sender's preference file
2. **Given** stored preferences exist for a sender, **When** the AI processes a new message from that sender, **Then** the preferences are included in the AI's context so it can personalize responses
3. **Given** a sender updates a preference (e.g., changes timezone from IST to PST), **When** the AI processes the update, **Then** the preference file is updated with the new value, not duplicated
4. **Given** preferences exist and the gateway is restarted, **When** the sender sends a new message, **Then** the preferences are loaded from disk and available to the AI
5. **Given** a sender sends "/clear", **When** the conversation is cleared, **Then** the preferences are NOT cleared — they persist independently of conversation history
6. **Given** the sender explicitly asks to forget a preference (e.g., "Forget my timezone"), **When** the AI processes this, **Then** the specific preference is removed from the preference file

---

### User Story 4 - Memory Flush Before Compression (Priority: P4)

Before the system compresses older messages, it performs a "memory flush" — an automated step that scans the about-to-be-compressed messages for any important facts, preferences, or decisions that should be preserved long-term. These are extracted and written to the sender's preference file or a long-term notes file before the raw messages are summarized. This prevents accidental loss of important context during compression.

**Why this priority**: This is a safety net that ensures compression doesn't silently lose critical information. It's important but only relevant once both persistence (US1) and compression (US2) are working.

**Independent Test**: Share a preference ("Remember I use Vim") in an early message. Continue the conversation until compression triggers. After compression, ask about the preference. Verify it was preserved either in the summary or in the preference file.

**Acceptance Scenarios**:

1. **Given** compression is about to run, **When** the pre-compression flush executes, **Then** the system asks the AI to identify any durable facts or preferences in the about-to-be-compressed messages
2. **Given** the flush identifies new preferences, **When** the preferences are extracted, **Then** they are written to the sender's preference file before compression proceeds
3. **Given** the flush finds no new durable information, **When** it completes, **Then** compression proceeds normally without delay
4. **Given** the flush encounters an error (e.g., AI is unreachable), **When** the error occurs, **Then** compression still proceeds (flush is best-effort, not blocking)

---

### Edge Cases

- What happens when the conversation history file is corrupted or contains invalid data? The system logs a warning and starts a fresh conversation for that sender, preserving any intact preference file
- What happens when disk space is exhausted and the system cannot write conversation files? The system continues operating in memory-only mode (current behavior) and logs an error alerting the operator
- What happens when two gateway instances try to write the same conversation file? Only a single gateway instance is expected per installation in v1; concurrent access is not supported
- What happens when a sender has preferences but no conversation history (e.g., after "/clear")? The preferences are loaded independently and still included in the AI context
- What happens when the compression summary itself becomes very large over many compression cycles? Each new compression summarizes the previous summary plus recent messages into a single new summary, keeping the summary bounded
- What happens when the system loads hundreds of conversation files on startup? Files are loaded lazily on first message from each sender, not all at startup, ensuring fast gateway start time

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST persist each sender's conversation history to a file in `~/.closeclaw/conversations/` so that history survives gateway restarts
- **FR-002**: Each sender's conversation MUST be stored in a separate file, identified by platform and sender ID (e.g., `telegram-123456.json`)
- **FR-003**: The system MUST save conversation state to disk after each message exchange (both the user message and the AI response)
- **FR-004**: When the gateway starts, the system MUST lazily load a sender's conversation from disk on their first incoming message, not eagerly load all conversations at startup
- **FR-005**: When a sender sends "/clear", the system MUST clear the conversation history file on disk (but preserve preferences)
- **FR-006**: The system MUST automatically compress older conversation messages into a summary when the raw message count exceeds a configurable threshold (default: 50 messages)
- **FR-007**: Compression MUST keep the most recent N messages verbatim (configurable, default: 20) and summarize everything before them
- **FR-008**: Compression MUST use the same AI model configured for the agent to generate the summary — no separate model configuration for compression in v1
- **FR-009**: Compression MUST NOT block the sender's message processing — it runs after the current response is delivered
- **FR-010**: Before compression, the system MUST perform a memory flush that asks the AI to identify durable facts and preferences from the messages about to be compressed
- **FR-011**: Facts and preferences identified during the flush MUST be written to the sender's preference file before compression proceeds
- **FR-012**: The system MUST store sender preferences in a dedicated file at `~/.closeclaw/preferences/<platform>-<senderId>.json`
- **FR-013**: The AI MUST be prompted to check for preference-worthy information on every message via the `save_preference` tool — the user does not need to say "remember" or any trigger word. Extraction is AI-driven and best-effort
- **FR-014**: The preference file MUST be loaded and included in the AI's system context for every message from that sender
- **FR-015**: Preferences MUST persist independently of conversation history — "/clear" does not erase preferences
- **FR-016**: The sender MUST be able to explicitly request forgetting specific preferences (e.g., "Forget my timezone")
- **FR-017**: The system MUST handle corrupted or invalid conversation/preference files gracefully by logging a warning and starting fresh
- **FR-018**: If disk writes fail, the system MUST continue operating in memory-only mode and log an error
- **FR-019**: Gateway startup time MUST NOT be affected by the number of stored conversation files (lazy loading)
- **FR-020**: The stale conversation pruning (from feature 002) MUST also clean up the corresponding disk files when an in-memory conversation is pruned

### Key Entities

- **ConversationFile**: A persisted conversation for a single sender. Attributes: platform, sender ID, messages (array of role/content/timestamp entries), optional compressed summary (text that replaces older messages), last modified timestamp
- **PreferenceFile**: A sender's durable preferences. Attributes: platform, sender ID, preferences (key-value pairs where keys are category names like "timezone", "name", "language_preference" and values are the user-stated preference text), last modified timestamp
- **CompressionSummary**: A condensed representation of older conversation messages. Attributes: summary text, number of messages summarized, timestamp of compression, range of original messages covered
- **MemoryFlush**: A pre-compression extraction of durable facts. Attributes: extracted preferences (list), source message range, timestamp

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Conversation history survives 100% of gateway restarts — the sender experiences continuity within 1 second of sending a follow-up message
- **SC-002**: Compression keeps the AI's context window usage bounded: regardless of conversation length, the context sent to the AI never exceeds the configured token limit
- **SC-003**: Message response time does not degrade as conversations grow — a conversation with 500 messages responds within the same time (±10%) as a conversation with 10 messages
- **SC-004**: User preferences persist across gateway restarts and are reflected in AI responses — asking the bot about a previously shared preference returns the correct answer 100% of the time
- **SC-005**: Gateway startup time remains under 2 seconds regardless of the number of stored conversation files (100+ files)
- **SC-006**: Compression does not cause any visible delay to the sender — the sender receives their response before compression begins
- **SC-007**: No data loss during compression — facts identified in the memory flush are preserved in the preference file or summary with 100% reliability (barring disk errors)

## Assumptions

- The existing in-memory `ConversationStore` (from feature 002) will be extended, not replaced — disk persistence wraps around the existing interface
- Conversation files are stored as JSON for easy parsing and direct editing by the user
- A single gateway instance accesses the conversation files at a time — no concurrent multi-instance locking is needed in v1
- The AI model configured for the agent is also used for generating compression summaries and extracting preferences (no separate model configuration)
- Preference extraction is AI-driven (the model identifies what to store) rather than rule-based (no regex pattern matching on user messages)
- The `~/.closeclaw/` directory already exists from the onboarding process (feature 001)
- Compression thresholds and "keep recent" counts are configurable via the agent configuration but have sensible defaults
- Preference files are small (typically under 50 entries) and can be loaded entirely into memory without performance concern
