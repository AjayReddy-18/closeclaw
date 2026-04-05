# Implementation Plan: Persistent Conversation Storage

**Branch**: `003-persistent-memory` | **Date**: 2026-04-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-persistent-memory/spec.md`

## Summary

Add disk-backed persistence, automatic compression, and user preference memory to CloseClaw's conversation system. Conversations are saved as JSON files in `~/.closeclaw/conversations/`, loaded lazily on first message per sender, and compressed by the AI model when they grow beyond 50 messages. User preferences (likes, timezone, name, etc.) are stored in separate files at `~/.closeclaw/preferences/` and injected into every AI context. A pre-compression "memory flush" extracts durable facts before older messages are summarized.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Node.js fs/path, existing `@closeclaw/ai-agent`, Vercel AI SDK (`generateText`)
**Storage**: JSON files on local disk (`~/.closeclaw/conversations/`, `~/.closeclaw/preferences/`)
**Testing**: Vitest (unit, integration, contract)
**Target Platform**: Node.js 22 LTS CLI + gateway
**Project Type**: CLI/gateway monorepo (pnpm)
**Performance Goals**: <2s gateway startup with 100+ files; message response time constant regardless of history length
**Constraints**: Functions ≤20 lines, files ≤200 lines, ≥90% coverage, no comments, lazy loading (no eager file reads at startup)
**Scale/Scope**: Single gateway instance, ~10–100 sender conversations

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                 | Status | Notes                                                                     |
| ------------------------- | ------ | ------------------------------------------------------------------------- |
| I. TDD                    | PASS   | Write tests for persistence, compression, preferences before implementing |
| II. Clean Code            | PASS   | All new files ≤200 lines, functions ≤20 lines, no comments                |
| III. Design Principles    | PASS   | Composition — wrap existing ConversationStore with persistence layer      |
| IV. Atomic Commits        | PASS   | One commit per logical unit; rebuild before committing                    |
| V. Automation-First       | PASS   | Compression and flush are fully automated                                 |
| VI. Modular Architecture  | PASS   | New files in existing `ai-agent` package; no circular deps                |
| VII. Living Documentation | PASS   | Update `docs/ai-agent.md` with persistence, compression, preferences      |

## Project Structure

### Documentation (this feature)

```text
specs/003-persistent-memory/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── persistence-store.ts
└── tasks.md
```

### Source Code (affected files)

```text
packages/
  shared-types/src/
    agent-config.ts                   # UPDATE: add compressionThreshold, keepRecentCount
  ai-agent/src/
    conversation-types.ts             # UPDATE: add compressedSummary field to Conversation
    conversation-persistence.ts       # NEW: read/write conversation JSON files
    conversation-compressor.ts        # NEW: summarize older messages using AI model
    persistent-conversation-store.ts  # NEW: decorator wrapping in-memory store with disk I/O
    preference-store.ts               # NEW: read/write/update preference JSON files
    persistence-types.ts              # NEW: on-disk data schemas
    persistence-serializer.ts         # NEW: serialize/deserialize between memory and disk formats
    preference-injection.ts           # NEW: format preferences for AI context
    tools/preference-tools.ts         # NEW: save_preference and forget_preference AI tools
    memory-flush.ts                   # NEW: pre-compression fact extraction
    ai-invoker.ts                     # NEW: AI model invocation logic (extracted from message-processor)
    message-processor.ts              # UPDATE: wire persistence save after each exchange
    index.ts                          # UPDATE: export new modules
  cli/src/commands/
    gateway-start.ts                  # UPDATE: pass persistence paths to conversation store
docs/
  ai-agent.md                        # UPDATE: document persistence, compression, preferences
tests/
  unit/ai-agent/
    conversation-persistence.test.ts  # NEW
    conversation-compressor.test.ts   # NEW
    preference-store.test.ts          # NEW
    preference-tools.test.ts          # NEW
    preference-injection.test.ts      # NEW
    memory-flush.test.ts              # NEW
  integration/ai-agent/
    persistence-flow.test.ts          # NEW: save → restart → load cycle
```

**Structure Decision**: All new source files go in the existing `@closeclaw/ai-agent` package since they extend conversation management. No new package needed. The `shared-types` package gets minor updates to `AgentConfig` for compression settings.

## Complexity Tracking

No constitution violations. All changes fit within existing package boundaries.
