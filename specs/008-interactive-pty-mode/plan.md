# Implementation Plan: Interactive PTY Mode for Cursor Agent

**Branch**: `008-interactive-pty-mode` | **Date**: 2026-04-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-interactive-pty-mode/spec.md`

## Summary

Replace the current dual-mode Cursor agent execution (broken tmux safe mode + force-flag trust mode) with a unified PTY-based approach using `node-pty`. Interactive mode (the new default) spawns Cursor CLI without `--print`/`--force` inside a pseudo-terminal, parses real-time output for progress and permission prompts, and relays user decisions from Telegram back to Cursor via PTY input. Trust mode remains available as an explicit override using the existing `--force --print --output-format stream-json` pipeline.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: node-pty (v1.1.0+), existing: grammY, Vercel AI SDK, Commander.js
**Storage**: Temporary session file (existing pattern in os.tmpdir)
**Testing**: Vitest for unit, integration, and contract tests
**Target Platform**: macOS (primary), Linux (secondary)
**Project Type**: CLI tool / pnpm monorepo
**Performance Goals**: Permission prompt relay < 3 seconds end-to-end
**Constraints**: Functions ≤ 20 lines, files ≤ 200 lines, 90%+ test coverage
**Scale/Scope**: Single user, single active Cursor session per user

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                 | Status | Notes                                              |
| ------------------------- | ------ | -------------------------------------------------- |
| I. TDD                    | PASS   | All new modules get tests first                    |
| II. Clean Code            | PASS   | No comments, ≤ 20 line functions, ≤ 200 line files |
| III. Design Principles    | PASS   | DI for node-pty, composition for runners           |
| IV. Atomic Commits        | PASS   | Each phase delivers testable, committable work     |
| V. Automation-First       | PASS   | PTY automates interactive terminal handling        |
| VI. Modular Architecture  | PASS   | New code in existing `packages/cursor-agent`       |
| VII. Living Documentation | PASS   | docs/cursor-agent.md updated                       |
| Code Quality              | PASS   | Strict TS, oxlint, Prettier                        |

## Project Structure

### Documentation (this feature)

```text
specs/008-interactive-pty-mode/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── pty-session-interfaces.ts
└── tasks.md
```

### Source Code (repository root)

```text
packages/cursor-agent/
├── src/
│   ├── pty-spawner.ts          # node-pty wrapper, DI-friendly
│   ├── pty-output-parser.ts    # Clean line extraction, ANSI stripping
│   ├── pty-permission-detector.ts  # Interactive prompt detection
│   ├── interactive-runner.ts   # Orchestrates PTY session lifecycle
│   ├── trust-mode-runner.ts    # Existing, unchanged
│   ├── session-manager.ts      # Updated: routes to interactive by default
│   ├── types.ts                # Updated: new PTY types
│   └── index.ts                # Updated: new exports
├── package.json                # Updated: node-pty dependency

packages/cli/src/commands/
├── cursor-setup.ts             # Updated: PTY spawner wiring
└── agent-init.ts               # Updated: permission forwarding via Telegram

packages/gateway/src/
└── gateway-agent-handler.ts    # Updated: permission prompt relay to user

tests/
├── unit/cursor-agent/
│   ├── pty-spawner.test.ts
│   ├── pty-output-parser.test.ts
│   ├── pty-permission-detector.test.ts
│   └── interactive-runner.test.ts
└── integration/
    └── pty-interactive-flow.test.ts
```

**Structure Decision**: All new PTY code lives in the existing `packages/cursor-agent` package. No new packages needed. The tmux-related code (`tmux-controller.ts`, `safe-mode-runner.ts`) will be removed since PTY replaces tmux entirely.

## Technical Approach

### How PTY Interactive Mode Works

1. **Spawn**: `node-pty.spawn(cursorAgentPath, [prompt], { cwd: projectDir })` — no `--print`, no `--force`. Cursor runs in its normal interactive mode inside a pseudo-terminal.

2. **Read output**: PTY emits `data` events with terminal text. An output parser strips ANSI escape codes and extracts meaningful lines — Cursor's text responses, tool usage descriptions, and permission prompts.

3. **Detect prompts**: When the output parser sees a permission prompt pattern (e.g., "Allow", "Accept/Deny", "(Y/n)"), it pauses and calls the `onPermission` callback.

4. **Relay to user**: The `onPermission` callback (wired at the gateway level) sends the prompt text to the user via Telegram and waits for their response (with a 2-minute timeout).

5. **Write input**: The user's decision is written back to the PTY as a keystroke (`Y` or `n`), and Cursor continues.

6. **Progress streaming**: Non-prompt output is throttled and forwarded to Telegram as progress messages every ~10 seconds.

7. **Completion**: When Cursor finishes (PTY process exits), the final output is parsed into a structured summary.

### Mode Routing (Updated)

- **Default (interactive)**: Uses PTY runner. No `--force` flag. Cursor asks permission for risky actions. User responds via Telegram.
- **Trust mode (explicit override only)**: Uses existing `--force --print --output-format stream-json` pipeline. Auto-approves everything.

### Key Design Decisions

1. **node-pty over tmux**: node-pty gives us programmatic read/write on a real PTY with clean API. tmux required screen-scraping and produced garbled output.

2. **ANSI stripping**: Terminal output includes escape codes for colors, cursor movement, etc. We strip these before parsing to get clean text.

3. **Permission timeout**: 2 minutes. Auto-deny on timeout. User is notified.

4. **Workspace trust**: We pass `--trust` flag when spawning via PTY (this flag works in headless mode to skip the workspace trust prompt). The interactive prompts we care about are the per-action permission prompts, not workspace trust.

5. **Remove tmux dependency**: tmux-controller.ts and safe-mode-runner.ts are removed. The availability check no longer checks for tmux.

## Complexity Tracking

_No constitution violations to justify._
