# Implementation Plan: Cursor CLI Agent Delegation

**Branch**: `007-cursor-cli-delegation` | **Date**: 2026-04-09 | **Spec**: `specs/007-cursor-cli-delegation/spec.md`
**Input**: Feature specification from `/specs/007-cursor-cli-delegation/spec.md`

## Summary

Add a new `packages/cursor-agent` package that lets the CloseClaw AI agent delegate coding tasks to a headless Cursor CLI session. Trust mode streams structured JSON events via `child_process.spawn`; safe mode runs inside tmux for interactive permission forwarding. Progress is streamed to the user in real-time, sessions can be resumed via Cursor's native `agent --resume`, and a configurable timeout prevents runaway execution.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Node.js `child_process` (spawn), `readline` (line parsing), `tmux` (safe mode TTY), Vercel AI SDK `tool()` + Zod (tool definitions)
**Storage**: In-memory Map + temp file (`os.tmpdir()/closeclaw-cursor-sessions.json`) for session mapping; `~/.closeclaw/config.json` (cursor agent config)
**Testing**: Vitest — unit + integration + contract
**Target Platform**: macOS / Linux (Node.js 22 LTS)
**Project Type**: CLI / Automation agent
**Performance Goals**: Permission prompts forwarded within 5 seconds; progress messages at least every 30 seconds
**Constraints**: One active Cursor session per user; configurable timeout (default 10 min)
**Scale/Scope**: Single-user local execution

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TDD | PASS | All cursor-agent modules will be TDD with mocked child_process/tmux |
| II. Clean Code | PASS | No comments, functions ≤ 20 lines, files ≤ 200 lines |
| III. Design Principles | PASS | New package follows SRP; interfaces injected for tmux/spawn |
| IV. Atomic Commits | PASS | Each layer (types, tmux, spawn, session manager, tools, prompt, CLI) is a commit |
| V. Automation-First | PASS | Core feature is automating code tasks via Cursor delegation |
| VI. Modular Architecture | PASS | New `packages/cursor-agent` with clean exports; no circular deps |
| VII. Living Documentation | PASS | `docs/cursor-agent.md` delivered with the feature |
| Code Quality | PASS | Strict TS, Zod schemas, explicit error handling |

## Project Structure

### Documentation (this feature)

```text
specs/007-cursor-cli-delegation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── cursor-session-interfaces.ts
└── tasks.md
```

### Source Code (repository root)

```text
packages/cursor-agent/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                     # barrel exports
│   ├── cursor-availability.ts       # detect cursor CLI + tmux
│   ├── trust-mode-runner.ts         # spawn with stream-json, parse events
│   ├── safe-mode-runner.ts          # tmux session, pane capture, permission detection
│   ├── tmux-controller.ts           # tmux shell commands abstraction
│   ├── stream-json-parser.ts        # parse stream-json events from stdout
│   ├── permission-detector.ts       # detect permission prompts in tmux output
│   ├── session-store.ts             # in-memory + temp file session tracking
│   ├── session-manager.ts           # orchestrate start/cancel/resume
│   └── types.ts                     # CursorSession, SessionStatus, etc.

packages/ai-agent/src/
├── tools/
│   ├── cursor-agent-tool.ts         # cursor_agent tool (delegate task)
│   └── cursor-resume-tool.ts        # cursor_resume tool (resume session)
├── system-prompt-builder.ts         # add Cursor Agent awareness section

packages/cli/src/commands/
├── gateway-start.ts                 # wire cursor-agent tools into extraTools
├── cursor-sessions-command.ts       # closeclaw cursor sessions (list)

tests/
├── unit/cursor-agent/
│   ├── cursor-availability.test.ts
│   ├── trust-mode-runner.test.ts
│   ├── safe-mode-runner.test.ts
│   ├── tmux-controller.test.ts
│   ├── stream-json-parser.test.ts
│   ├── permission-detector.test.ts
│   ├── session-store.test.ts
│   └── session-manager.test.ts
├── unit/ai-agent/
│   ├── cursor-agent-tool.test.ts
│   └── cursor-resume-tool.test.ts
└── integration/
    └── cursor-delegation-flow.test.ts

docs/
└── cursor-agent.md                  # user-facing documentation
```

**Structure Decision**: New `packages/cursor-agent` package following the same pattern as `packages/mcp-client`. The AI agent tools live in `packages/ai-agent/src/tools/` alongside existing tools. CLI wiring goes in `packages/cli/src/commands/`.

## Architecture

### Dual-Mode Execution

```text
User → Telegram → Gateway → AI Agent → cursor_agent tool
                                          │
                            ┌──────────────┴──────────────┐
                            │                             │
                     Trust Mode                     Safe Mode
                   (--force flag)              (interactive perms)
                            │                             │
                  child_process.spawn            tmux session
                  --output-format                capture-pane
                    stream-json                  send-keys
                            │                             │
                     parse JSON events         poll for prompts
                     stream progress           forward to user
                            │                             │
                            └──────────────┬──────────────┘
                                           │
                                    TaskResult to user
```

### Mode Decision

The AI agent decides the execution mode automatically based on task risk:
- **Trust mode**: Low-risk tasks (lint fixes, formatting, doc generation, simple additions)
- **Safe mode**: High-risk tasks (refactoring, architecture changes, deletions, config changes)
The user can override explicitly ("use trust mode", "use force mode", "use safe mode"). No confirmation prompt — the agent picks and goes.

### Trust Mode Flow

1. AI agent calls `cursor_agent` tool with prompt and project dir (mode chosen by agent or user override)
2. `trust-mode-runner.ts` spawns: `cursor agent -p --force --output-format stream-json --stream-partial-output "{prompt}"` with `cwd` set to project dir
3. `stream-json-parser.ts` reads stdout line-by-line, emits typed events
4. Progress events trigger `onProgress` callback → messages to user
5. `result` or process exit → return `TaskResult`
6. Timeout timer kills the process if exceeded

### Safe Mode Flow

1. AI agent calls `cursor_agent` tool with `mode: "safe"`
2. `safe-mode-runner.ts` creates tmux session, runs: `cursor agent -p "{prompt}"` inside it
3. Poll loop (every 2s) reads `tmux capture-pane -p -S -50`
4. `permission-detector.ts` scans output for approval prompt patterns
5. When prompt detected: callback to user, wait for accept/deny, `tmux send-keys` the response
6. When "result" or "completed" detected (or process exits): return `TaskResult`
7. Timeout timer kills tmux session if exceeded

### Session Resume Flow

1. User says "resume cursor task"
2. AI agent calls `cursor_resume` tool
3. `session-manager.ts` checks in-memory map first, falls back to temp file for recent CloseClaw sessions
4. If a CloseClaw session is found: resume with `cursor agent --resume=<chat-id>` (trust or safe mode based on original session)
5. If no CloseClaw session found: fall back to `cursor agent ls`, parse output, let user pick
6. Same progress/permission flow as original execution

**Session storage strategy**: In-memory `Map` during gateway lifetime + temp file in `os.tmpdir()`. Entries older than 24h are pruned on gateway startup. No permanent storage — Cursor CLI manages its own session persistence natively.

### Tool Definitions

**`cursor_agent`** tool parameters:
- `prompt` (string, required): The coding task description
- `projectDir` (string, required): Absolute path to the project
- `mode` (enum "safe" | "trust", optional, default "safe"): Execution mode

**`cursor_resume`** tool parameters:
- `chatId` (string, optional): Specific Cursor chat ID to resume. If omitted, resumes the most recent.

### Permission Forwarding

The AI agent's `cursor_agent` tool receives an `onPermission` callback from the session manager. When the permission detector fires:

1. Session status changes to `waiting_approval`
2. The prompt text is sent to the user via the bot adapter
3. A pending promise waits for the user's response
4. The gateway's message handler detects an active cursor session with `waiting_approval` status
5. The user's reply ("accept"/"deny"/"yes"/"no") resolves the promise
6. `tmux send-keys` sends the appropriate keystroke
7. Session status returns to `running`

If no response within configurable timeout (default 2 minutes), auto-deny.

### System Prompt Addition

Add a `buildCursorAgentSection` function to `system-prompt-builder.ts` that appends when cursor tools are available:

```text
Cursor Agent (code delegation):
- You can delegate coding tasks to a local Cursor agent using the cursor_agent tool.
- Use this for: refactoring, adding tests, fixing lint errors, writing code, analyzing codebases.
- Do NOT use this for: simple questions, non-code tasks, tasks you can answer from memory.
- Choose the mode automatically based on task risk — do NOT ask the user to pick:
  - trust: lint fixes, formatting, doc generation, simple additions
  - safe: refactoring, architecture changes, deletions, config changes
- If the user explicitly says "use trust/force mode" or "use safe mode", respect that override.
- To resume a previous session, use the cursor_resume tool.
```

## Dependency Graph (implementation order)

```text
Layer 0: types.ts (shared types, no deps)
Layer 1: cursor-availability.ts, stream-json-parser.ts, permission-detector.ts, tmux-controller.ts, session-store.ts (temp file + in-memory)
Layer 2: trust-mode-runner.ts (depends: stream-json-parser, types)
         safe-mode-runner.ts (depends: tmux-controller, permission-detector, types)
Layer 3: session-manager.ts (depends: trust-mode-runner, safe-mode-runner, session-store, cursor-availability, types)
Layer 4: cursor-agent-tool.ts, cursor-resume-tool.ts (depends: session-manager)
Layer 5: system-prompt-builder.ts update, gateway-start.ts wiring, cursor-sessions-command.ts
Layer 6: integration tests, docs
```

## Complexity Tracking

No constitution violations to track. All new modules follow existing patterns.
