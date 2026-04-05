# Research: Persistent Conversation Storage

## Decision 1: Storage Format

**Decision**: JSON files, one per sender, named `<platform>-<senderId>.json`
**Rationale**: JSON is natively parseable in TypeScript with zero dependencies. It supports structured data (messages array, summary object, timestamps) and is human-editable. Markdown (OpenClaw's approach) is better for human reading but harder to parse reliably for structured conversation data with metadata.
**Alternatives considered**:

- Markdown files (OpenClaw-style): Better readability but requires custom parser. CloseClaw conversations are structured data (role, content, timestamp), not prose — JSON is a better fit.
- SQLite: More powerful queries but adds a native dependency, complicates the monorepo build, and is overkill for per-sender file storage.
- Single large JSON file: Simpler to manage but doesn't support lazy loading — every sender's data would be loaded on startup.

## Decision 2: Persistence Architecture

**Decision**: Decorator/wrapper pattern around the existing `ConversationStore`. A `PersistentConversationStore` wraps the in-memory store and adds disk I/O after each state change.
**Rationale**: This preserves the existing interface (`ConversationStore`) that the `MessageProcessor` and gateway already depend on. No changes to existing consumers. The persistence logic is orthogonal to the in-memory caching.
**Alternatives considered**:

- Modify `createConversationStore` directly: Violates SRP. Mixes caching logic with I/O. Harder to test.
- Separate persistence service called from `message-processor.ts`: Scatters persistence concerns across multiple call sites. The store is the single source of truth and should manage its own persistence.

## Decision 3: Compression Approach

**Decision**: "Rolling summary" — when message count exceeds threshold, the system sends older messages to the AI with a summarization prompt, replaces them with the resulting summary, and keeps recent messages verbatim. The summary is stored as a special `compressedSummary` field in the conversation.
**Rationale**: Mirrors OpenClaw's compaction strategy. The AI model produces high-quality summaries that preserve context better than rule-based truncation. Using the same model avoids additional configuration.
**Alternatives considered**:

- Simple truncation (drop oldest messages): Fast but loses context entirely. Defeats the purpose of persistence.
- Hierarchical summaries (tree of summaries): More thorough but significantly more complex. YAGNI for v1 — a single rolling summary is sufficient.
- Separate compression model: Adds configuration complexity. Same model keeps it simple per user's decision.

## Decision 4: Preference Extraction

**Decision**: AI-driven extraction using a tool. The AI model is given a `save_preference` tool that it can call whenever it identifies preference-worthy information in the conversation. The tool writes to the sender's preference file.
**Rationale**: Using a tool is the cleanest integration with the existing Vercel AI SDK tool-calling infrastructure. The AI decides what constitutes a preference (no rigid regex rules). The tool approach means extraction happens naturally during message processing — no separate post-processing pass.
**Alternatives considered**:

- Post-processing pass after each message: Requires a separate AI call per message just for preference extraction. Doubles API costs. The tool approach embeds extraction into the existing response generation.
- Regex/keyword matching: Fragile, misses nuanced preferences, and can't handle natural language variations.
- Separate scheduled extraction job: Too delayed — preferences should be available immediately for the next message.

## Decision 5: When to Save to Disk

**Decision**: Save after each complete message exchange (user message + AI response). Use atomic writes (write to `.tmp` then rename) to prevent corruption.
**Rationale**: Saving after each exchange ensures minimal data loss on crash. Atomic writes (already used by `pairing-store.ts`) prevent partial writes from corrupting the file.
**Alternatives considered**:

- Debounced writes (save every N seconds): Risks losing the last few messages on crash. The per-exchange approach is simple and reliable.
- Write-ahead log: Overkill for single-instance file storage.

## Decision 6: Lazy Loading Strategy

**Decision**: Conversations are loaded from disk on first `getOrCreate` call per sender. The persistent store checks if a file exists for the sender's key and hydrates the in-memory conversation from it.
**Rationale**: Ensures O(1) startup time regardless of file count. Only active senders incur disk I/O. Aligns with FR-004 and FR-019.
**Alternatives considered**:

- Eager loading at startup: Simple but scales poorly. 100+ files would add seconds to startup.
- Background pre-loading after startup: Adds complexity for marginal benefit. Most senders won't message immediately after restart.

## Decision 7: Memory Flush Implementation

**Decision**: Before compression, send the about-to-be-compressed messages to the AI with a prompt asking it to list any durable facts, preferences, or important decisions. Parse the response and write identified preferences to the preference file. This is best-effort — errors don't block compression.
**Rationale**: Mirrors OpenClaw's "automatic memory flush" before compaction. Prevents silent loss of important facts during compression.
**Alternatives considered**:

- Skip flush entirely: Simpler but risks losing preferences that were mentioned once in a long conversation and then compressed away.
- Rule-based extraction during flush: Same limitations as regex-based preference extraction — can't handle natural language.
