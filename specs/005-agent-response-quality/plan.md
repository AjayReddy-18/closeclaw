# Implementation Plan: Agent Response Quality

**Branch**: `005-agent-response-quality` | **Date**: 2026-04-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-agent-response-quality/spec.md`

## Summary

Enhance CloseClaw's agent response pipeline with three improvements: (1) platform-aware response formatting that converts AI-generated markdown to Telegram-compatible HTML before delivery, (2) a suppression filter for scheduled task responses that prevents noisy "still running" messages and only delivers meaningful updates, and (3) a rich default system prompt that guides the AI on conciseness, formatting, tool usage, and conversation style.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: grammY (Telegram), Discord.js (Discord), Vercel AI SDK (`ai@^6.0.0`), `@closeclaw/ai-agent`, `@closeclaw/bot-adapters`, `@closeclaw/gateway`
**Storage**: JSON files (`~/.closeclaw/conversations/`, `~/.closeclaw/preferences/`, `~/.closeclaw/cron/tasks.json`)
**Testing**: Vitest (unit, integration, contract)
**Target Platform**: Node.js (macOS/Linux)
**Project Type**: CLI + gateway monorepo
**Performance Goals**: Response formatting adds < 100ms latency per message
**Constraints**: Telegram 4096-char message limit; MarkdownV2/HTML parse_mode compatibility; no new runtime dependencies for formatting (pure TypeScript)
**Scale/Scope**: Single-user, single-bot instance

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                 | Status | Notes                                                                                                                |
| ------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| I. TDD                    | PASS   | All new modules (formatter, suppression filter, system prompt) will be test-first                                    |
| II. Clean Code            | PASS   | Functions ≤ 20 lines, files ≤ 200 lines, no comments, descriptive names                                              |
| III. Design Principles    | PASS   | Formatter uses Strategy pattern (per-platform); suppression is a pure filter function; DI throughout                 |
| IV. Atomic Commits        | PASS   | Each phase is independently committable and testable                                                                 |
| V. Automation-First       | PASS   | Smart suppression directly reduces manual "noise" in automated monitoring                                            |
| VI. Modular Architecture  | PASS   | Formatter is a new module in `bot-adapters`, suppression filter in `ai-agent/scheduler`, system prompt in `ai-agent` |
| VII. Living Documentation | PASS   | `docs/` updated with response formatting and suppression behavior                                                    |

No violations. No entries needed in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/005-agent-response-quality/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── formatter-interfaces.ts
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
packages/
├── bot-adapters/src/
│   ├── telegram-adapter.ts          # Modified: use formatForTelegram + parse_mode + message splitting
│   ├── discord-adapter.ts           # Modified: pass-through (no formatting changes)
│   ├── formatter/
│   │   ├── markdown-to-telegram.ts  # New: convert markdown → Telegram HTML
│   │   ├── message-splitter.ts      # New: split long messages at safe boundaries
│   │   └── index.ts                 # New: re-exports
│   └── adapter.ts                   # Modified: sendMessage signature may carry format hints
│
├── ai-agent/src/
│   ├── system-prompt-builder.ts     # New: rich default system prompt assembly
│   ├── ai-invoker.ts               # Modified: use new prompt builder
│   ├── scheduler/
│   │   ├── suppression-filter.ts    # New: evaluate whether a scheduled response is meaningful
│   │   └── task-scheduler.ts        # Modified: apply suppression filter before deliver()
│   └── index.ts                     # Modified: export new modules
│
├── shared-types/src/
│   └── agent-config.ts              # Modified: DEFAULT_SYSTEM_PROMPT replaced with richer default
│
└── cli/src/commands/
    └── scheduler-setup.ts           # Modified: wire suppression into deliver pipeline

tests/
├── unit/
│   ├── bot-adapters/
│   │   ├── formatter/
│   │   │   ├── markdown-to-telegram.test.ts
│   │   │   └── message-splitter.test.ts
│   │   └── telegram-adapter.test.ts     # Modified: verify parse_mode and formatting
│   └── ai-agent/
│       ├── system-prompt-builder.test.ts
│       ├── scheduler/
│       │   └── suppression-filter.test.ts
│       └── ai-invoker.test.ts           # Modified: verify new prompt structure
├── integration/
│   ├── response-formatting-flow.test.ts
│   └── scheduler-suppression-flow.test.ts
└── contract/
    └── telegram-format.test.ts          # Validates Telegram HTML output structure
```

**Structure Decision**: Follows existing monorepo layout. Formatter lives in `bot-adapters` (platform-specific concern). Suppression filter lives in `ai-agent/scheduler` (scheduling concern). System prompt builder lives in `ai-agent` (agent behavior concern). No new packages needed.
