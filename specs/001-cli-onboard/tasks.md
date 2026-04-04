# Tasks: CLI Onboard Command

**Input**: Design documents from `/specs/001-cli-onboard/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: TDD is NON-NEGOTIABLE per constitution. Tests are written FIRST, verified to FAIL, then implementation follows.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `packages/<package>/src/` for source, `tests/` at repository root
- Packages: `shared-types`, `bot-adapters`, `gateway`, `cli`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize pnpm monorepo, configure all 4 packages, and set up tooling

- [x] T001 Initialize pnpm monorepo with pnpm-workspace.yaml listing packages/shared-types, packages/bot-adapters, packages/gateway, packages/cli
- [x] T002 Create root package.json with workspace scripts (build, test, lint, format) and devDependencies (typescript, vitest, oxlint, prettier, tsdown, tsx)
- [x] T003 Create root tsconfig.json with strict mode enabled, no `any` permitted, and path aliases for workspace packages
- [x] T004 [P] Create packages/shared-types/package.json with name @closeclaw/shared-types and zero runtime dependencies
- [x] T005 [P] Create packages/bot-adapters/package.json with name @closeclaw/bot-adapters and dependencies on @closeclaw/shared-types (workspace:*), grammy, discord.js
- [x] T006 [P] Create packages/gateway/package.json with name @closeclaw/gateway and dependencies on @closeclaw/shared-types (workspace:*), @closeclaw/bot-adapters (workspace:*)
- [x] T007 [P] Create packages/cli/package.json with name @closeclaw/cli and dependencies on @closeclaw/shared-types (workspace:*), @closeclaw/gateway (workspace:*), commander, @inquirer/prompts
- [x] T008 Create packages/cli/package.json bin entry pointing to dist/index.js for the `closeclaw` command
- [x] T009 [P] Configure vitest.config.ts at root with workspace test support
- [x] T010 [P] Configure oxlint (oxlintrc.json) and prettier (.prettierrc) at root
- [x] T011 Run pnpm install and verify all packages resolve with zero errors

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared type definitions and config infrastructure that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T012 [P] Unit test for BotPlatform and DmPolicy enums in tests/unit/shared-types/enums.test.ts
- [x] T013 [P] Unit test for BotIntegration type validation in tests/unit/shared-types/bot-integration.test.ts
- [x] T014 [P] Unit test for GatewayConfig type validation in tests/unit/shared-types/gateway-config.test.ts
- [x] T015 [P] Unit test for Configuration type validation in tests/unit/shared-types/configuration.test.ts
- [x] T016 [P] Unit test for PairingRequest and PairingStore types in tests/unit/shared-types/pairing.test.ts
- [x] T017 [P] Unit test for config-reader in tests/unit/cli/config-reader.test.ts
- [x] T018 [P] Unit test for config-writer (atomic write pattern) in tests/unit/cli/config-writer.test.ts
- [x] T019 [P] Unit test for config-detector in tests/unit/cli/config-detector.test.ts
- [x] T020 [P] Contract test for configuration JSON schema in tests/contract/config-schema.test.ts

### Implementation for Foundational

- [x] T021 [P] Implement BotPlatform enum in packages/shared-types/src/bot-platform.ts
- [x] T022 [P] Implement DmPolicy enum in packages/shared-types/src/dm-policy.ts
- [x] T023 [P] Implement BotIntegration interface and validation in packages/shared-types/src/bot-integration.ts
- [x] T024 [P] Implement GatewayConfig interface and validation in packages/shared-types/src/gateway-config.ts
- [x] T025 [P] Implement Configuration interface and validation in packages/shared-types/src/configuration.ts
- [x] T026 [P] Implement PairingRequest, PairingStatus, PairingStore, ApprovedSender types in packages/shared-types/src/pairing-request.ts
- [x] T027 Create packages/shared-types/src/index.ts barrel export for all types
- [x] T028 Implement BotAdapter interface (connect, disconnect, healthCheck, onMessage) in packages/bot-adapters/src/adapter.ts
- [x] T029 Implement config-reader with JSON parsing and malformed file handling in packages/cli/src/config/config-reader.ts
- [x] T030 Implement config-writer with atomic write pattern (write to .tmp then rename) in packages/cli/src/config/config-writer.ts
- [x] T031 Implement config-detector (first-time vs existing config detection) in packages/cli/src/config/config-detector.ts

**Checkpoint**: Foundation ready — shared types exported, config read/write/detect tested, adapter interface defined. User story implementation can now begin.

---

## Phase 3: User Story 1 — First-Time Bot Onboarding (Priority: P1) MVP

**Goal**: A new user runs `closeclaw onboard` and completes first-time setup: platform selection, bot creation instructions, token collection, DM policy, gateway auto-config, health check, success summary.

**Independent Test**: Run `closeclaw onboard` on a clean machine (no `~/.closeclaw`) and verify config file exists with bot credentials, DM policy, gateway settings, and health check passes.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T032 [P] [US1] Unit test for Telegram token validation in tests/unit/cli/token-validation.test.ts
- [ ] T033 [P] [US1] Unit test for Discord token validation in tests/unit/cli/token-validation.test.ts
- [ ] T034 [P] [US1] Unit test for platform-select prompt in tests/unit/cli/platform-select.test.ts
- [ ] T035 [P] [US1] Unit test for token-input prompt in tests/unit/cli/token-input.test.ts
- [ ] T036 [P] [US1] Unit test for dm-policy-select prompt in tests/unit/cli/dm-policy-select.test.ts
- [ ] T037 [P] [US1] Unit test for Telegram setup instructions in tests/unit/cli/telegram-instructions.test.ts
- [ ] T038 [P] [US1] Unit test for Discord setup instructions in tests/unit/cli/discord-instructions.test.ts
- [ ] T039 [P] [US1] Unit test for TelegramAdapter (getMe health check) in tests/unit/bot-adapters/telegram-adapter.test.ts
- [ ] T040 [P] [US1] Unit test for DiscordAdapter (login + ready event) in tests/unit/bot-adapters/discord-adapter.test.ts
- [ ] T041 [P] [US1] Unit test for health-checker in tests/unit/gateway/health-checker.test.ts
- [ ] T042 [P] [US1] Unit test for gateway-server HTTP endpoints in tests/unit/gateway/gateway-server.test.ts
- [ ] T043 [P] [US1] Unit test for onboard command orchestration in tests/unit/cli/onboard-command.test.ts
- [ ] T044 [P] [US1] Contract test for closeclaw onboard exit codes in tests/contract/cli-commands.test.ts
- [ ] T045 [US1] Integration test for first-time onboard flow in tests/integration/onboard-flow.test.ts

### Implementation for User Story 1

- [ ] T046 [P] [US1] Implement TelegramAdapter (grammY bot.api.getMe for health check, long polling for messages) in packages/bot-adapters/src/telegram-adapter.ts
- [ ] T047 [P] [US1] Implement DiscordAdapter (client.login + ready event for health check, message listener) in packages/bot-adapters/src/discord-adapter.ts
- [ ] T048 [US1] Create packages/bot-adapters/src/index.ts barrel export
- [ ] T049 [P] [US1] Implement platform-select prompt (Telegram or Discord) in packages/cli/src/prompts/platform-select.ts
- [ ] T050 [P] [US1] Implement token-input prompt with masked input and format validation in packages/cli/src/prompts/token-input.ts
- [ ] T051 [P] [US1] Implement dm-policy-select prompt (pairing default, allowlist, open with warning) in packages/cli/src/prompts/dm-policy-select.ts
- [ ] T052 [P] [US1] Implement Telegram setup instructions (BotFather steps) in packages/cli/src/instructions/telegram-setup.ts
- [ ] T053 [P] [US1] Implement Discord setup instructions (Developer Portal steps) in packages/cli/src/instructions/discord-setup.ts
- [ ] T054 [US1] Implement gateway auto-configuration (localhost, random auth token, default port 18790) in packages/gateway/src/gateway-config-generator.ts
- [ ] T055 [US1] Implement health-checker (call adapter.healthCheck, format pass/fail result) in packages/gateway/src/health-checker.ts
- [ ] T056 [US1] Implement gateway-server with /health endpoint in packages/gateway/src/gateway-server.ts
- [ ] T057 [US1] Implement onboard command orchestrating the full first-time flow in packages/cli/src/commands/onboard.ts
- [ ] T058 [US1] Wire Commander.js CLI entry point with `closeclaw onboard` subcommand in packages/cli/src/index.ts
- [ ] T059 [US1] Implement Ctrl+C graceful exit handling (catch ExitPromptError, clean up, exit 130) in packages/cli/src/commands/onboard.ts

**Checkpoint**: User Story 1 complete — `closeclaw onboard` works end-to-end for first-time setup with health check. MVP is functional.

---

## Phase 4: User Story 2 — Approve Pairing Request (Priority: P2)

**Goal**: Bot responds to unapproved DMs with a pairing code. Owner runs `closeclaw pairing list` and `closeclaw pairing approve <code>` to approve senders.

**Independent Test**: Complete onboarding (US1), send a DM to the bot, run `closeclaw pairing list`, run `closeclaw pairing approve <code>`, verify sender can now communicate.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T060 [P] [US2] Unit test for pairing code generation (6-char alphanumeric, crypto-based) in tests/unit/gateway/pairing-manager.test.ts
- [ ] T061 [P] [US2] Unit test for pairing-manager (create, list, approve, expire logic) in tests/unit/gateway/pairing-manager.test.ts
- [ ] T062 [P] [US2] Unit test for dm-policy-enforcer (pairing, allowlist, open modes) in tests/unit/gateway/dm-policy-enforcer.test.ts
- [ ] T063 [P] [US2] Unit test for pairing-list command in tests/unit/cli/pairing-list.test.ts
- [ ] T064 [P] [US2] Unit test for pairing-approve command in tests/unit/cli/pairing-approve.test.ts
- [ ] T065 [P] [US2] Contract test for GET /pairing and POST /pairing/approve endpoints in tests/contract/cli-commands.test.ts
- [ ] T066 [US2] Integration test for full pairing flow in tests/integration/pairing-flow.test.ts

### Implementation for User Story 2

- [ ] T067 [US2] Implement pairing-manager (code generation, store read/write, approve, expire cleanup) in packages/gateway/src/pairing-manager.ts
- [ ] T068 [US2] Implement dm-policy-enforcer (check sender against policy, trigger pairing or reject) in packages/gateway/src/dm-policy-enforcer.ts
- [ ] T069 [US2] Add GET /pairing and POST /pairing/approve endpoints to gateway-server in packages/gateway/src/gateway-server.ts
- [ ] T070 [US2] Wire DM policy enforcer into bot adapter message handlers in packages/gateway/src/gateway-server.ts
- [ ] T071 [US2] Implement pairing-list command (read from gateway API, display table) in packages/cli/src/commands/pairing-list.ts
- [ ] T072 [US2] Implement pairing-approve command (POST to gateway API, display result) in packages/cli/src/commands/pairing-approve.ts
- [ ] T073 [US2] Wire `closeclaw pairing list` and `closeclaw pairing approve` subcommands in packages/cli/src/index.ts

**Checkpoint**: User Stories 1 AND 2 complete — full onboarding + pairing approval flow works end-to-end.

---

## Phase 5: User Story 3 — Add a New Bot to Existing Configuration (Priority: P3)

**Goal**: User with one bot configured runs `closeclaw onboard` and adds a second platform without affecting the first.

**Independent Test**: Pre-populate config with Telegram, run `closeclaw onboard`, choose "Add new integration", select Discord, verify both exist in config.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T074 [P] [US3] Unit test for existing-config detection prompting add-new/reset in tests/unit/cli/onboard-existing.test.ts
- [ ] T075 [P] [US3] Unit test for filtering already-configured platforms in tests/unit/cli/platform-filter.test.ts
- [ ] T076 [US3] Integration test for add-new-bot flow in tests/integration/config-persistence.test.ts

### Implementation for User Story 3

- [ ] T077 [US3] Implement existing-config branch in onboard command (detect config, prompt add-new or reset) in packages/cli/src/commands/onboard.ts
- [ ] T078 [US3] Implement platform filtering (only show unconfigured platforms) in packages/cli/src/prompts/platform-select.ts
- [ ] T079 [US3] Implement add-new-bot flow (reuse platform setup, merge into existing config) in packages/cli/src/commands/onboard.ts
- [ ] T080 [US3] Handle all-platforms-configured case (display message, suggest reset) in packages/cli/src/commands/onboard.ts

**Checkpoint**: User Stories 1, 2, AND 3 complete — multi-platform onboarding works.

---

## Phase 6: User Story 4 — Reset Existing Configuration (Priority: P4)

**Goal**: User can reset all or a specific platform's configuration and re-onboard.

**Independent Test**: Pre-populate config with both platforms, run `closeclaw onboard`, choose "Reset", verify the chosen scope of reset is applied.

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T081 [P] [US4] Unit test for reset-all flow in tests/unit/cli/onboard-reset.test.ts
- [ ] T082 [P] [US4] Unit test for reset-specific-platform flow in tests/unit/cli/onboard-reset.test.ts
- [ ] T083 [US4] Integration test for reset flow with confirmation in tests/integration/config-persistence.test.ts

### Implementation for User Story 4

- [ ] T084 [US4] Implement reset scope prompt (all vs specific platform) in packages/cli/src/commands/onboard.ts
- [ ] T085 [US4] Implement reset confirmation with consequence warning in packages/cli/src/commands/onboard.ts
- [ ] T086 [US4] Implement config-writer reset logic (clear all or remove specific channel) in packages/cli/src/config/config-writer.ts
- [ ] T087 [US4] Re-trigger first-time flow after reset in packages/cli/src/commands/onboard.ts

**Checkpoint**: User Stories 1–4 complete — full onboarding lifecycle (setup, pair, add, reset) works.

---

## Phase 7: User Story 5 — View Instructions Without Configuring (Priority: P5)

**Goal**: User can view platform setup instructions and defer token entry to come back later.

**Independent Test**: Run `closeclaw onboard`, select a platform, view instructions, choose to exit — verify no partial config saved.

### Tests for User Story 5

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T088 [P] [US5] Unit test for defer-token-entry flow in tests/unit/cli/onboard-defer.test.ts
- [ ] T089 [US5] Integration test for deferred exit (no partial writes) in tests/integration/onboard-flow.test.ts

### Implementation for User Story 5

- [ ] T090 [US5] Add "ready to proceed or come back later" prompt after instructions in packages/cli/src/commands/onboard.ts
- [ ] T091 [US5] Implement deferred exit (no config writes, clean exit code 0) in packages/cli/src/commands/onboard.ts

**Checkpoint**: All 5 user stories complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T092 [P] Add error handling for port-already-in-use (detect conflict, try next port) in packages/gateway/src/gateway-server.ts
- [ ] T093 [P] Add malformed config file handling (offer reset or exit) in packages/cli/src/config/config-reader.ts
- [ ] T094 [P] Add permission error handling for ~/.closeclaw directory in packages/cli/src/config/config-writer.ts
- [ ] T095 Run quickstart.md validation (end-to-end manual test following quickstart steps)
- [ ] T096 Verify all tests pass with `pnpm test` and coverage meets near-100% target
- [ ] T097 Run oxlint and prettier across entire codebase, fix any violations

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — MVP delivery
- **User Story 2 (Phase 4)**: Depends on US1 (needs running gateway with bot adapters)
- **User Story 3 (Phase 5)**: Depends on Foundational — can run in parallel with US2
- **User Story 4 (Phase 6)**: Depends on Foundational — can run in parallel with US2/US3
- **User Story 5 (Phase 7)**: Depends on US1 instructions implementation — can run in parallel with US2/US3/US4
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational only — no other story dependencies
- **User Story 2 (P2)**: Depends on US1 (needs gateway running with bot adapters and DM policy)
- **User Story 3 (P3)**: Depends on Foundational only — independent of US2
- **User Story 4 (P4)**: Depends on Foundational only — independent of US2/US3
- **User Story 5 (P5)**: Depends on US1 instructions — independent of US2/US3/US4

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Types/interfaces before services
- Services before CLI commands
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T004–T007: All package.json files can be created in parallel
- T009–T010: Vitest and linting config in parallel
- T012–T020: All foundational tests in parallel
- T021–T026: All shared-types implementations in parallel
- T032–T045: All US1 tests in parallel
- T046–T053: Bot adapters and prompts in parallel
- T060–T066: All US2 tests in parallel
- US3, US4, US5 can run in parallel after their dependencies are met

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (TDD: write first, verify they fail):
Task: T032 "Unit test for Telegram token validation"
Task: T033 "Unit test for Discord token validation"
Task: T034-T038 "Unit tests for all prompts and instructions"
Task: T039-T042 "Unit tests for bot adapters and gateway"

# Launch all bot adapters in parallel:
Task: T046 "Implement TelegramAdapter"
Task: T047 "Implement DiscordAdapter"

# Launch all prompts in parallel:
Task: T049 "Implement platform-select prompt"
Task: T050 "Implement token-input prompt"
Task: T051 "Implement dm-policy-select prompt"

# Launch all instructions in parallel:
Task: T052 "Implement Telegram setup instructions"
Task: T053 "Implement Discord setup instructions"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run `closeclaw onboard` end-to-end
5. Demo-ready MVP

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → MVP!
3. Add User Story 2 → Test independently → Bot is usable with pairing
4. Add User Story 3 → Test independently → Multi-platform support
5. Add User Story 4 → Test independently → Full lifecycle (reset)
6. Add User Story 5 → Test independently → Polished UX (deferred instructions)
7. Polish → Production-ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- TDD is NON-NEGOTIABLE: verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All file paths are relative to repository root
