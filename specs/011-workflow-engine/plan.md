# Implementation Plan: Workflow Engine

**Branch**: `011-workflow-engine` | **Date**: 2026-04-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/011-workflow-engine/spec.md`

## Summary

Build a lean, in-process workflow engine that lets users create multi-step automations via natural language chat or hand-written YAML. Workflows support conditional branching, parallel execution, loops with polling, human-in-the-loop approval pauses, and three trigger types (cron, webhook, chat keyword). The engine builds on existing primitives: the scheduler for cron triggers, the tool system for step execution via `processMessage`, the orchestrator pattern for parallel fan-out, the approval queue for pauses, and live messages for progress updates. A new `@closeclaw/workflow` package contains the core runtime; integration wiring lives in `@closeclaw/cli` and `@closeclaw/gateway`.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Vercel AI SDK (`ai@^6.0.0`), `yaml` (new, for YAML parsing), `zod` (for schema validation)
**Storage**: JSON + YAML files in `~/.closeclaw/workflows/` (definitions in both formats, execution history as JSON). One-shot execution records stored under `_oneshot/`
**Testing**: Vitest (unit, integration, contract)
**Target Platform**: Node.js 22 LTS
**Project Type**: pnpm monorepo package (`packages/workflow/`)
**Performance Goals**: <2x overhead over raw step duration for sequential execution; parallel steps run concurrently
**Constraints**: Functions <= 20 lines, files <= 200 lines, no comments, 90%+ test coverage
**Scale/Scope**: Personal automation tool — max 20 steps/workflow, 5 parallel branches, 50 loop iterations, 3 concurrent workflows per user

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TDD | PASS | All modules built test-first; unit tests for every public function, integration tests for execution flows, contract tests for YAML schema and AI tool schemas |
| II. Clean Code | PASS | No comments, functions <= 20 lines, files <= 200 lines. StepNode discriminated union keeps types clean |
| III. Design Principles | PASS | Composition over inheritance (factory functions, not classes). All deps injected and mockable. KISS: AI evaluates conditions instead of custom expression engine. YAGNI: no checkpointing/resume for v1 |
| IV. Atomic Commits | PASS | Phases decompose into independently committable units |
| V. Automation-First | PASS | The entire feature IS automation. Idempotent re-execution for saved workflows |
| VI. Modular Architecture | PASS | New `packages/workflow/` package with explicit boundaries. No circular deps. Contracts defined in `contracts/` |
| VII. Living Documentation | PASS | `docs/workflows.md` created as part of implementation |

**Post-Phase 1 re-check**: PASS. No violations introduced by data model or contract design. StepNode union type with discriminated `type` field keeps the model clean without inheritance.

## Project Structure

### Documentation (this feature)

```text
specs/011-workflow-engine/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── workflow-interfaces.ts
│   ├── workflow-yaml-schema.yaml
│   ├── ai-tool-schemas.ts
│   └── webhook-api.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/workflow/
├── package.json
├── tsconfig.json
├── tsdown.config.ts
├── src/
│   ├── index.ts                    # Public exports
│   ├── types.ts                    # WorkflowDefinition, StepNode, ExecutionRecord, etc.
│   ├── workflow-store.ts           # JSON persistence (definitions + history)
│   ├── workflow-validator.ts       # Zod schema validation for definitions
│   ├── yaml-parser.ts             # YAML → WorkflowDefinition conversion
│   ├── step-executor.ts           # Execute a single step via processMessage
│   ├── condition-evaluator.ts     # AI-based condition evaluation
│   ├── output-interpolator.ts     # {{stepId.output}} template resolution
│   ├── workflow-runner.ts         # Core DAG execution engine
│   ├── parallel-executor.ts       # Promise.allSettled for parallel branches
│   ├── loop-executor.ts           # Repeat-until-condition with delay
│   ├── approval-handler.ts        # Pause/resume for human-in-the-loop
│   ├── progress-reporter.ts       # LiveMessage updates per step
│   ├── execution-recorder.ts      # Build and persist ExecutionRecord
│   └── resource-limits.ts         # Named constants for limits
│
packages/ai-agent/src/
│   ├── tools/
│   │   ├── create-workflow-tool.ts   # AI tool: create_workflow (signal tool pattern)
│   │   └── manage-workflow-tool.ts   # AI tool: manage_workflow, run_workflow
│   └── system-prompt-builder.ts      # Add WORKFLOW_GUIDANCE section
│
packages/gateway/src/
│   └── gateway-routes.ts             # Add POST /webhooks/:workflowId route
│
packages/cli/src/commands/
│   ├── workflow-setup.ts             # Factory: wire store + scheduler + executor + tools
│   ├── workflow-scheduler.ts         # Cron trigger: arm/disarm workflows
│   └── gateway-start.ts             # Wire workflow system into gateway startup

tests/
├── unit/workflow/
│   ├── workflow-store.test.ts
│   ├── workflow-validator.test.ts
│   ├── yaml-parser.test.ts
│   ├── step-executor.test.ts
│   ├── condition-evaluator.test.ts
│   ├── output-interpolator.test.ts
│   ├── workflow-runner.test.ts
│   ├── parallel-executor.test.ts
│   ├── loop-executor.test.ts
│   ├── approval-handler.test.ts
│   ├── progress-reporter.test.ts
│   └── execution-recorder.test.ts
├── unit/ai-agent/
│   ├── create-workflow-tool.test.ts
│   └── manage-workflow-tool.test.ts
├── integration/
│   └── workflow-execution-flow.test.ts
└── contract/
    └── workflow-schema.test.ts

docs/
└── workflows.md                      # User-facing documentation
```

**Structure Decision**: New `packages/workflow/` package following the same pattern as `packages/orchestrator/` — isolated module with its own types, persistence, and runtime. Integration wiring in `packages/cli/` and `packages/gateway/`. AI tools in `packages/ai-agent/`.

## Architecture

### Execution Flow

```
User message → AI agent → create_workflow tool (signal pattern)
                        → gateway detects workflowPlanRef.plan
                        → one-shot: execute immediately
                        → reusable: confirm with user → save → arm trigger

Trigger fires → WorkflowScheduler → WorkflowRunner.execute(definition)
             → Step 1: interpolate outputs → processMessage → record result
             → Step 2: condition? → AI evaluates → choose branch
             → Step 3: parallel? → Promise.allSettled → merge results
             → Step 4: loop? → repeat with delay until condition met
             → Step N: approval? → pause → prompt user → resume/abort
             → Finalize: record ExecutionRecord, deliver summary
```

### Key Design Decisions

1. **Signal Tool Pattern** (same as `parallel_tasks`): The `create_workflow` AI tool populates a `WorkflowPlanRef` object. After `processMessage` returns, the gateway checks the ref and either executes immediately (one-shot) or confirms and saves (reusable).

2. **Steps Execute via processMessage**: Each step is a prompt sent through the full AI agent pipeline. This means steps automatically have access to all tools (MCP, shell, HTTP, datetime). The AI model decides which tools to use based on the prompt.

3. **AI-Evaluated Conditions**: Condition steps send the previous step's output + the condition text to the AI model, which returns "true" or "false". This lets conditions be natural language ("are there critical bugs?") without a custom expression parser.

4. **Output Interpolation**: Steps reference previous outputs via `{{stepId.output}}`. The runtime resolves these from a `StepOutputContext` map before passing the prompt to `processMessage`.

5. **Webhook Routes**: New `POST /webhooks/:workflowId` route on the existing gateway HTTP server. Authenticated via per-workflow secret in the `Authorization` header.

6. **Chat Keyword Trigger**: A pre-AI pattern match in the message handler. If a message matches a workflow's keyword trigger, the workflow executes instead of (or in addition to) normal AI processing.

### Package Dependency Graph

```
@closeclaw/workflow (new)
  ├── depends on: @closeclaw/shared-types (for BotPlatform)
  ├── depends on: yaml (new npm dependency)
  └── depends on: zod (existing)

@closeclaw/ai-agent
  └── new tools: create_workflow, manage_workflow, run_workflow

@closeclaw/gateway
  └── new route: POST /webhooks/:workflowId

@closeclaw/cli
  └── new wiring: workflow-setup.ts, workflow-scheduler.ts
```

### Reuse of Existing Primitives

| Existing Primitive | Reused For | How |
|--------------------|------------|-----|
| `processMessage` | Step execution | Each step is a prompt through the full AI agent pipeline |
| `createLiveMessage` | Per-workflow progress | Single live message per execution, updated per step |
| `createApprovalQueue` | Approval pauses | Serialize approval prompts across concurrent workflows |
| `createTaskScheduler` pattern | Cron triggers | Similar timer-based scheduling, adapted for workflow definitions |
| `routeRequest` | Webhook triggers | New route branch in gateway-routes.ts |
| `OrchestrationPlanRef` pattern | `WorkflowPlanRef` | Signal tool pattern for create_workflow |
| `Promise.allSettled` | Parallel steps | Same pattern as orchestrator for concurrent branches |
| Atomic JSON write | Persistence | Same `writeFileSync(tmp) → renameSync` pattern as task-store |

## Complexity Tracking

No constitution violations requiring justification. All design choices follow KISS (AI-evaluated conditions instead of custom expression parser), YAGNI (no checkpoint/resume for v1), and Modular Architecture (isolated `packages/workflow/`).
