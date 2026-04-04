<!--
SYNC IMPACT REPORT
===================
Version change: 1.0.0 → 1.1.0
Modified principles: None renamed or redefined
Added sections:
  - Technology Stack (new section between Code Quality Standards
    and Development Workflow)
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ aligned
    (Technical Context section already supports language/deps/testing)
  - .specify/templates/spec-template.md ✅ aligned
    (technology-agnostic by design, no conflict)
  - .specify/templates/tasks-template.md ✅ aligned
    (path conventions already support src/ layout)
  - .specify/templates/checklist-template.md ✅ aligned
    (generic, no constitution references)
  - .specify/templates/agent-file-template.md ✅ aligned
    (Active Technologies section will be populated from plans)
Follow-up TODOs: None
-->

# CloseClaw Constitution

## Core Principles

### I. Test-Driven Development (NON-NEGOTIABLE)

- All production code MUST be written using the Red-Green-Refactor cycle:
  write a failing test first, implement the minimum code to pass, then refactor
- Test coverage MUST target near 100% for all production code
- Unit tests MUST cover every public function and every branch
- Integration tests MUST cover all module boundaries and external interactions
- Contract tests MUST validate API surfaces and data schemas
- No pull request or merge is permitted if test coverage regresses
- Tests MUST be deterministic, isolated, and fast

### II. Clean Code (NON-NEGOTIABLE)

- Code MUST be self-documenting through clear naming of variables,
  functions, classes, and modules
- Comments are FORBIDDEN in production code; if code requires a comment
  to be understood, the code MUST be refactored for clarity
- Exceptions: legal headers, TODO markers tied to tracked issues, and
  public API doc-strings where the language ecosystem mandates them
- No function MUST exceed 20 lines of logic (excluding declarations
  and blank lines); extract when approaching this limit
- No file MUST exceed 200 lines; split by responsibility when approaching
  this limit
- All names MUST reveal intent: no abbreviations, no single-letter
  variables outside trivial loop indices
- No dead code, no commented-out code, no unreachable branches

### III. Design Principles & Patterns

- SOLID principles MUST guide all class and module design
- DRY: duplication MUST be extracted once a pattern appears twice
- KISS: the simplest solution that satisfies requirements MUST be chosen
- YAGNI: no speculative features; build only what is needed now
- Favor composition over inheritance
- Depend on abstractions, not concretions; all external
  dependencies MUST be injected and mockable
- Design patterns MUST be applied only when they solve a concrete
  problem, never for their own sake

### IV. Atomic Commits

- Every commit MUST represent a single, coherent, working change
- The test suite MUST pass at every commit; no commit is allowed to
  break the build
- Commit messages MUST follow Conventional Commits format:
  `type(scope): description`
- Permitted types: feat, fix, refactor, test, docs, chore, ci
- Each commit SHOULD be independently revertible without side effects
- Large changes MUST be decomposed into a sequence of atomic commits
  rather than delivered as a single monolithic changeset

### V. Automation-First

- CloseClaw exists to eliminate manual intervention in repetitive tasks
- Every workflow that a human repeats more than once MUST be a candidate
  for automation
- Automation pipelines MUST be idempotent and retry-safe
- All automation MUST be observable: structured logging, clear error
  reporting, and deterministic exit codes
- Manual overrides MUST exist as escape hatches but MUST NOT be the
  default path
- CI/CD pipelines MUST enforce linting, formatting, testing, and
  coverage gates before merge

### VI. Modular Architecture

- The system MUST be composed of small, focused modules with explicit
  boundaries and well-defined interfaces
- Each module MUST be independently testable and deployable
- Inter-module communication MUST use documented contracts (interfaces,
  schemas, or protocols)
- Circular dependencies between modules are FORBIDDEN
- New features MUST start as isolated modules before integrating into
  the broader system

## Code Quality Standards

- A consistent formatter and linter MUST be enforced across the entire
  codebase with zero tolerance for violations
- All code MUST pass static analysis with no warnings before merge
- Type safety MUST be maximized: use the strictest type-checking mode
  available in the chosen language
- Error handling MUST be explicit; no swallowed exceptions, no bare
  catch-all handlers
- Magic numbers and magic strings are FORBIDDEN; use named constants
- All public interfaces MUST validate their inputs at the boundary

## Technology Stack

- **Language**: TypeScript (strict mode enabled, no `any` permitted)
- **Runtime**: Node.js (latest LTS or current stable)
- **Package Manager**: pnpm with workspace support for monorepo layout
- **Testing**: Vitest for unit, integration, and contract tests
- **Linting**: oxlint (Rust-based, zero-config where possible)
- **Formatting**: oxfmt or Prettier (one formatter, enforced globally)
- **Build**: tsdown or tsx for development, tsdown for production builds
- **Gateway Protocol**: WebSocket and HTTP for server-to-server and
  bot platform communication
- **Bot Integrations**: grammY (Telegram), Discord.js (Discord), with
  an adapter pattern to support additional platforms without coupling
- **Project Layout**: pnpm monorepo with packages for gateway, bot
  adapters, automation engine, and shared types

**Rationale**: TypeScript is chosen over Python for the following
reasons:

1. OpenClaw (the reference project) is ~90% TypeScript; ecosystem
   alignment reduces friction for contributors and enables code reuse
2. Node.js event-loop architecture provides superior throughput for
   WebSocket gateways and concurrent bot connections compared to
   Python's GIL-constrained threading model
3. TypeScript's static type system enforces correctness at compile
   time, directly supporting the Clean Code and Code Quality principles
4. The Telegram (grammY) and Discord (Discord.js) TypeScript libraries
   are first-class, actively maintained, and type-safe by default
5. pnpm workspaces provide proven monorepo tooling aligned with the
   Modular Architecture principle

## Development Workflow

- The trunk-based development model MUST be followed: short-lived
  feature branches merged frequently into main
- Every feature branch MUST have a corresponding specification before
  implementation begins
- The development cycle for every change is: Specify → Plan → Test →
  Implement → Refactor → Commit → Review
- Code review is MANDATORY for all changes; self-review is acceptable
  for solo development but MUST follow a documented checklist
- Continuous Integration MUST run the full test suite, linter, and
  formatter on every push
- Broken builds MUST be fixed before any new work begins

## Governance

- This constitution is the supreme authority for all development
  decisions in the CloseClaw project
- Any practice, pattern, or tool choice that conflicts with these
  principles MUST be rejected or escalated for a constitution amendment
- Amendments require: (1) a documented rationale, (2) review of
  downstream impact on all templates and artifacts, and (3) a version
  bump following semantic versioning (MAJOR for principle
  removals/redefinitions, MINOR for additions/expansions, PATCH for
  clarifications)
- All pull requests and code reviews MUST verify compliance with this
  constitution
- Complexity beyond these principles MUST be justified in writing and
  tracked in the plan's Complexity Tracking table

**Version**: 1.1.0 | **Ratified**: 2026-04-05 | **Last Amended**: 2026-04-05
