# Implementation Plan: Multi-Agent Orchestration

**Branch**: `010-multi-agent-orchestration` | **Date**: 2026-04-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-multi-agent-orchestration/spec.md`

## Summary

Enable CloseClaw's AI agent to decompose complex user requests into independent subtasks, execute them concurrently via `Promise.allSettled`, and deliver per-subtask live progress through separate `LiveMessage` instances. A combined summary is sent after all subtasks complete. The orchestration layer sits between the gateway handler and the message processor, reusing existing `LiveMessage`, approval-handler, and Cursor delegation infrastructure.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Vercel AI SDK (`ai@^6.0.0`), grammY, Discord.js, node-pty, Zod
**Storage**: File-based (JSON) for conversations, preferences, sessions — no changes needed
**Testing**: Vitest (unit, integration, contract) — 90%+ coverage required
**Target Platform**: Node.js 22 LTS (macOS primary, Linux CI)
**Project Type**: CLI + local gateway (pnpm monorepo)
**Performance Goals**: 3+ independent subtasks complete 40%+ faster than sequential; per-subtask progress updates within 3s
**Constraints**: Max 5 concurrent subtasks per request; Telegram rate limits (~30 req/s per bot); functions ≤ 20 lines, files ≤ 200 lines
**Scale/Scope**: Single user, single gateway instance, 1-5 concurrent subtasks

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Status | Notes |
| --------- | ------ | ----- |
| I. TDD | PASS | All orchestration code must be test-first. Subtask runner, orchestrator, approval queue are all independently testable. |
| II. Clean Code | PASS | Orchestrator and subtask runner are separate files. Each function ≤ 20 lines. No comments. |
| III. Design Principles | PASS | Composition: orchestrator composes subtask runners. DI: LiveMessage factory injected. KISS: reuse existing LiveMessage, don't invent new messaging. |
| IV. Atomic Commits | PASS | Feature decomposes into: orchestrator types → subtask runner → orchestrator → tool definitions → gateway wiring → approval queue → summary builder → system prompt → tests → docs. |
| V. Automation-First | PASS | Core purpose: automate parallel task execution. |
| VI. Modular Architecture | PASS | New `packages/orchestrator` package with explicit interfaces. No circular deps. |
| VII. Living Documentation | PASS | `docs/multi-agent-orchestration.md` required before merge. |

**Post-Phase 1 Re-check**: All gates still pass. The new `orchestrator` package depends on `bot-adapters` (for LiveMessage) and `ai-agent` (for MessageProcessor type). No circular dependencies introduced.

## Project Structure

### Documentation (this feature)

```text
specs/010-multi-agent-orchestration/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── orchestrator/              # NEW — Multi-agent orchestration
│   ├── src/
│   │   ├── index.ts           # Public exports
│   │   ├── orchestrator.ts    # Core: decompose → fan-out → collect → summarize
│   │   ├── subtask-runner.ts  # Runs a single subtask with its own LiveMessage
│   │   ├── approval-queue.ts  # Sequential approval queue for parallel subtasks
│   │   ├── summary-builder.ts # Aggregates subtask results into final summary
│   │   └── types.ts           # Interfaces: SubtaskPlan, SubtaskResult, OrchestrationSession
│   └── package.json
├── ai-agent/src/
│   ├── tools/
│   │   └── parallel-tasks-tool.ts  # NEW — AI tool for decomposing into subtasks
│   └── system-prompt-builder.ts    # MODIFIED — Add orchestration guidance section
├── gateway/src/
│   ├── gateway-agent-handler.ts    # MODIFIED — Detect orchestration response, delegate
│   └── approval-handler.ts         # MODIFIED — Support taskId-scoped approval keys
└── bot-adapters/src/
    └── live-message.ts             # UNCHANGED — Already per-instance, works as-is

tests/
├── unit/
│   ├── orchestrator/
│   │   ├── orchestrator.test.ts
│   │   ├── subtask-runner.test.ts
│   │   ├── approval-queue.test.ts
│   │   └── summary-builder.test.ts
│   ├── ai-agent/
│   │   └── parallel-tasks-tool.test.ts
│   └── gateway/
│       └── orchestrated-handler.test.ts
└── integration/
    └── orchestration-flow.test.ts
```

**Structure Decision**: New `packages/orchestrator` package follows the existing monorepo pattern. It depends on `@closeclaw/bot-adapters` (for `LiveMessage`) and defines its own types. The gateway package orchestrates the wiring, keeping the orchestrator package focused on execution logic.

## Complexity Tracking

No constitution violations. No complexity exceptions needed.
