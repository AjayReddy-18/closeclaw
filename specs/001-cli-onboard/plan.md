# Implementation Plan: CLI Onboard Command

**Branch**: `001-cli-onboard` | **Date**: 2026-04-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-cli-onboard/spec.md`

## Summary

Build the `closeclaw onboard` CLI command that guides users through interactive bot integration setup for Telegram and Discord. The command detects existing configurations, supports first-time onboarding (with DM access policy selection and gateway auto-configuration), add-new-bot and reset flows, persists configuration to `~/.closeclaw/closeclaw.json`, starts a local gateway, runs a health check, and supports pairing-based access control via `closeclaw pairing list` and `closeclaw pairing approve <code>`.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, no `any`)
**Runtime**: Node.js 22 LTS
**Package Manager**: pnpm with workspace support
**Primary Dependencies**: Commander.js (CLI framework), @inquirer/prompts (interactive prompts), grammY (Telegram Bot API), Discord.js (Discord Bot API)
**Storage**: JSON file at `~/.closeclaw/closeclaw.json`
**Testing**: Vitest for unit, integration, and contract tests
**Linting**: oxlint
**Formatting**: Prettier
**Build**: tsdown for production, tsx for development
**Target Platform**: macOS, Linux, Windows (via Node.js)
**Project Type**: CLI tool with background gateway process
**Performance Goals**: Health check completes within 10 seconds; pairing approval response within 30 seconds
**Constraints**: Interactive-only (no `--non-interactive` in v1); localhost gateway only; Telegram + Discord only
**Scale/Scope**: Single-user CLI tool; 2 bot platforms; ~20 source files across 4 packages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. TDD (NON-NEGOTIABLE) | PASS | All modules designed for testability; Vitest configured; bot adapters use injected dependencies for mocking |
| II. Clean Code (NON-NEGOTIABLE) | PASS | No function exceeds 20 lines by design (small focused modules); no comments; intent-revealing names |
| III. Design Principles & Patterns | PASS | Adapter pattern for bot platforms (SOLID/OCP); dependency injection for all external services; composition over inheritance |
| IV. Atomic Commits | PASS | Feature decomposed into independently committable packages and modules |
| V. Automation-First | PASS | Gateway auto-configured with sensible defaults; health check automated; CI/CD gates planned |
| VI. Modular Architecture | PASS | 4 packages with explicit boundaries: cli, gateway, bot-adapters, shared-types |
| Code Quality Standards | PASS | TypeScript strict mode; oxlint; Prettier; input validation at all boundaries |
| Technology Stack | PASS | TypeScript, Node.js, pnpm, Vitest, Commander.js, grammY, Discord.js — all aligned |

## Project Structure

### Documentation (this feature)

```text
specs/001-cli-onboard/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── cli-commands.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/
├── shared-types/
│   └── src/
│       ├── configuration.ts
│       ├── bot-integration.ts
│       ├── gateway-config.ts
│       ├── pairing-request.ts
│       └── dm-policy.ts
├── bot-adapters/
│   └── src/
│       ├── adapter.ts
│       ├── telegram-adapter.ts
│       └── discord-adapter.ts
├── gateway/
│   └── src/
│       ├── gateway-server.ts
│       ├── health-checker.ts
│       ├── pairing-manager.ts
│       └── dm-policy-enforcer.ts
└── cli/
    └── src/
        ├── index.ts
        ├── commands/
        │   ├── onboard.ts
        │   ├── pairing-list.ts
        │   └── pairing-approve.ts
        ├── prompts/
        │   ├── platform-select.ts
        │   ├── token-input.ts
        │   └── dm-policy-select.ts
        ├── instructions/
        │   ├── telegram-setup.ts
        │   └── discord-setup.ts
        └── config/
            ├── config-reader.ts
            ├── config-writer.ts
            └── config-detector.ts

tests/
├── unit/
│   ├── shared-types/
│   ├── bot-adapters/
│   ├── gateway/
│   └── cli/
├── integration/
│   ├── onboard-flow.test.ts
│   ├── pairing-flow.test.ts
│   └── config-persistence.test.ts
└── contract/
    ├── cli-commands.test.ts
    └── config-schema.test.ts
```

**Structure Decision**: pnpm monorepo with 4 packages — `shared-types` (data models and interfaces), `bot-adapters` (platform-specific bot connections), `gateway` (local server, health check, pairing), and `cli` (Commander.js commands, interactive prompts). This aligns with the Modular Architecture principle: each package has explicit boundaries, is independently testable, and communicates via documented contracts (TypeScript interfaces in `shared-types`).

## Complexity Tracking

No constitution violations to justify.
