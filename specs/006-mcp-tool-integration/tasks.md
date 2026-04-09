# Tasks: MCP Tool Integration

**Input**: Design documents from `/specs/006-mcp-tool-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — project constitution mandates TDD (Red-Green-Refactor cycle).

**Organization**: Tasks grouped by user story. US1 (Agent Uses MCP Tools) and US2 (CLI Management) are both P1 but US2 is a prerequisite for US1 in practice (you need config to connect). US3 (Health Visibility) is P2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Package Scaffolding)

**Purpose**: Create `packages/mcp-client` package structure, install dependencies

- [x] T001 Create `packages/mcp-client/package.json` with dependencies: `@ai-sdk/mcp@^1.0.35`, `@ai-sdk/provider@^3.0.0`, `@closeclaw/shared-types@workspace:*`, `zod@^3.25.76`
- [x] T002 Create `packages/mcp-client/src/index.ts` barrel export (empty initially)
- [x] T003 Create `packages/mcp-client/tsconfig.json` extending root config
- [x] T004 Add `@closeclaw/mcp-client@workspace:*` dependency to `packages/cli/package.json`
- [x] T005 Run `pnpm install` and verify workspace links resolve

**Checkpoint**: Package exists, builds, workspace links work

---

## Phase 2: Foundational (Types + Config Layer)

**Purpose**: Config types, loader, writer, and env interpolation — shared by ALL user stories

**CRITICAL**: No user story work can begin until this phase is complete

### Tests

- [x] T006 [P] Write unit tests for env interpolation in `tests/unit/mcp-client/mcp-env-interpolator.test.ts` — covers `${env:VAR}` replacement, missing vars, nested values, no-op for plain strings
- [x] T007 [P] Write unit tests for config types validation in `tests/unit/mcp-client/mcp-config-types.test.ts` — covers stdio config validation, http config validation, discriminated union, enabled default, malformed input
- [x] T008 [P] Write unit tests for config loader in `tests/unit/mcp-client/mcp-config-loader.test.ts` — covers load from file, missing file returns empty, malformed JSON warning, env interpolation applied to headers
- [x] T009 [P] Write unit tests for config writer in `tests/unit/mcp-client/mcp-config-writer.test.ts` — covers add server, remove server, create file if missing, replace existing with confirmation
- [x] T010 [P] Write contract test for config schema in `tests/contract/mcp-config-schema.test.ts` — validates stdio and http config shapes against the contract

### Implementation

- [x] T011 [P] Implement `McpServerConfig` types (discriminated union) in `packages/mcp-client/src/mcp-config-types.ts` — `StdioServerConfig`, `HttpServerConfig`, `McpConfigFile`, validation functions `isValidStdioConfig`, `isValidHttpConfig`, `isValidMcpConfigFile`
- [x] T012 [P] Implement env interpolation in `packages/mcp-client/src/mcp-env-interpolator.ts` — `interpolateEnvVars(value: string): string` and `interpolateRecord(record: Record<string, string>): Record<string, string>`
- [x] T013 Implement config loader in `packages/mcp-client/src/mcp-config-loader.ts` — `loadMcpConfig(configPath: string): McpServerConfig[]` reads JSON, validates, applies env interpolation to headers/env, returns parsed configs (depends on T011, T012)
- [x] T014 Implement config writer in `packages/mcp-client/src/mcp-config-writer.ts` — `addServer(configPath, name, entry)`, `removeServer(configPath, name)`, `listServers(configPath)` with atomic writes (depends on T011)
- [x] T015 Update barrel exports in `packages/mcp-client/src/index.ts` — export all types, loader, writer, interpolator
- [x] T016 Verify all Phase 2 tests pass with `pnpm vitest run tests/unit/mcp-client tests/contract/mcp-config-schema`

**Checkpoint**: Config layer complete — can read, write, validate `~/.closeclaw/mcp.json`

---

## Phase 3: User Story 2 — Managing MCP Servers via CLI (Priority: P1)

**Goal**: Users can add, remove, and list MCP server configurations using `closeclaw mcp` commands

**Independent Test**: Run `closeclaw mcp add test-server`, provide details, verify `~/.closeclaw/mcp.json` updated. Run `closeclaw mcp list` to see the table. Run `closeclaw mcp remove test-server` to delete it.

### Tests

- [x] T017 [P] [US2] Write unit tests for `mcp add` command in `tests/unit/cli/mcp-add.test.ts` — covers stdio prompts, http prompts, duplicate name replacement, new file creation
- [x] T018 [P] [US2] Write unit tests for `mcp remove` command in `tests/unit/cli/mcp-remove.test.ts` — covers successful removal, not-found error
- [x] T019 [P] [US2] Write unit tests for `mcp list` command in `tests/unit/cli/mcp-list.test.ts` — covers table output, empty list, mixed types

### Implementation

- [x] T020 [P] [US2] Implement `runMcpAdd` in `packages/cli/src/commands/mcp-add.ts` — interactive prompts for transport type, connection details, duplicate check (depends on T014)
- [x] T021 [P] [US2] Implement `runMcpRemove` in `packages/cli/src/commands/mcp-remove.ts` — remove by name, error if not found (depends on T014)
- [x] T022 [P] [US2] Implement `runMcpList` in `packages/cli/src/commands/mcp-list.ts` — table display of all configured servers (depends on T014)
- [x] T023 [US2] Implement `registerMcpCommands` in `packages/cli/src/commands/mcp-registry.ts` — register `mcp add`, `mcp remove`, `mcp list` subcommands following the cron-registry pattern (depends on T020, T021, T022)
- [x] T024 [US2] Wire `registerMcpCommands` into `packages/cli/src/cli.ts` — add alongside `registerCronCommands` and `registerHeartbeatCommands` (depends on T023)
- [x] T025 [US2] Verify all US2 tests pass with `pnpm vitest run tests/unit/cli/mcp-`

**Checkpoint**: `closeclaw mcp add/remove/list` commands work end-to-end

---

## Phase 4: User Story 1 — Agent Uses MCP Tools During Conversation (Priority: P1) MVP

**Goal**: Gateway connects to configured MCP servers at startup, discovers tools, registers them with the AI model so it can call them during conversations

**Independent Test**: Configure a test MCP server in `~/.closeclaw/mcp.json`. Start the gateway. Send a message that requires the MCP tool. Verify the agent discovers and calls it.

### Tests

- [x] T026 [P] [US1] Write unit tests for transport factory in `tests/unit/mcp-client/mcp-transport-factory.test.ts` — covers stdio transport creation, http/sse transport creation, invalid config rejection
- [x] T027 [P] [US1] Write unit tests for connection manager in `tests/unit/mcp-client/mcp-connection-manager.test.ts` — covers connectAll with mock clients, tool namespacing (`server__tool`), graceful failure for unreachable server, closeAll cleanup, getAllTools merge
- [x] T028 [P] [US1] Write integration test for MCP gateway flow in `tests/integration/mcp-gateway-flow.test.ts` — covers gateway startup with MCP config, tool discovery, tool injection into extraTools, graceful degradation on failure

### Implementation

- [x] T029 [US1] Implement transport factory in `packages/mcp-client/src/mcp-transport-factory.ts` — `createTransport(config: McpServerConfig)` returns stdio `StdioMCPTransport` or http `{ type: 'sse', url, headers }` (depends on T011)
- [x] T030 [US1] Implement connection manager in `packages/mcp-client/src/mcp-connection-manager.ts` — `createConnectionManager()` with `connectAll(configs)`, `getAllTools()`, `getStatus()`, `closeAll()` methods. Uses `experimental_createMCPClient` from `@ai-sdk/mcp`. Applies `serverName__toolName` namespacing. Parallel connection with per-server timeout. (depends on T029)
- [x] T031 [US1] Update barrel exports in `packages/mcp-client/src/index.ts` — add transport factory, connection manager, and status types
- [x] T032 [US1] Modify `packages/cli/src/commands/gateway-start.ts` — after config load and before `assembleAgent`, call `loadMcpConfig` + `connectionManager.connectAll`, log each server status, merge `getAllTools()` into `extraTools` alongside scheduler tools, add `closeAll()` to the `finally` block (depends on T030)
- [x] T033 [US1] Verify all US1 tests pass with `pnpm vitest run tests/unit/mcp-client/mcp-transport tests/unit/mcp-client/mcp-connection tests/integration/mcp-gateway`

**Checkpoint**: Gateway discovers MCP tools at startup and the AI model can call them during conversation

---

## Phase 5: User Story 3 — MCP Server Health Visibility (Priority: P2)

**Goal**: Users can check which MCP servers are connected and healthy via startup logs and `closeclaw mcp status`

**Independent Test**: Configure two servers (one reachable, one not). Start gateway — verify log output shows one connected, one failed. Run `closeclaw mcp status` — verify table output.

### Tests

- [x] T034 [P] [US3] Write unit tests for `mcp status` command in `tests/unit/cli/mcp-status.test.ts` — covers connected/failed/disabled display, tool count, error messages

### Implementation

- [x] T035 [US3] Implement `runMcpStatus` in `packages/cli/src/commands/mcp-status.ts` — loads config, creates temporary connection manager, connectAll, displays status table, closeAll (depends on T030)
- [x] T036 [US3] Register `mcp status` subcommand in `packages/cli/src/commands/mcp-registry.ts` (depends on T035, T023)
- [x] T037 [US3] Verify US3 tests pass with `pnpm vitest run tests/unit/cli/mcp-status`

**Checkpoint**: `closeclaw mcp status` shows health of all configured servers

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, coverage, build, and final validation

- [x] T038 [P] Create user-facing documentation in `docs/mcp-integration.md` — configuration format, CLI commands, gateway startup behavior, env variable interpolation, troubleshooting
- [x] T039 [P] Update `docs/cli-reference.md` — add `closeclaw mcp add/remove/list/status` command reference
- [x] T040 [P] Update `docs/ai-agent.md` — add section on MCP tool discovery and usage
- [x] T041 Verify test coverage meets 90% threshold with `pnpm test:coverage`
- [x] T042 Build all packages with `pnpm build` and verify dist/ outputs
- [x] T043 Run full lint + format check with `pnpm lint && pnpm format:check`
- [x] T044 Run quickstart.md validation — manually test the quickstart flow end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US2 — CLI Management (Phase 3)**: Depends on Foundational (config loader/writer)
- **US1 — Agent MCP Tools (Phase 4)**: Depends on Foundational (config loader) + US2 gives config to test against
- **US3 — Health Visibility (Phase 5)**: Depends on US1 (connection manager)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US2 (CLI Management)**: Can start immediately after Foundational. No dependency on other stories.
- **US1 (Agent MCP Tools)**: Can start after Foundational. Logically benefits from US2 (to create configs) but is not blocked by it — test configs can be created manually.
- **US3 (Health Visibility)**: Depends on connection manager from US1.

### Within Each User Story

- Tests MUST be written FIRST and FAIL before implementation
- Types/models before services
- Services before CLI commands
- Core implementation before integration wiring
- Story complete before moving to next priority

### Parallel Opportunities

- T006, T007, T008, T009, T010 — all Phase 2 tests can run in parallel
- T011, T012 — types and interpolator can be built in parallel
- T017, T018, T019 — all US2 tests can run in parallel
- T020, T021, T022 — all US2 command implementations can run in parallel
- T026, T027, T028 — all US1 tests can run in parallel
- T034 — US3 test is independent
- T038, T039, T040 — all documentation tasks can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for US1 together:
Task: "Unit test transport factory in tests/unit/mcp-client/mcp-transport-factory.test.ts"
Task: "Unit test connection manager in tests/unit/mcp-client/mcp-connection-manager.test.ts"
Task: "Integration test MCP gateway flow in tests/integration/mcp-gateway-flow.test.ts"

# Then implement:
Task: "Transport factory in packages/mcp-client/src/mcp-transport-factory.ts"
# After transport factory:
Task: "Connection manager in packages/mcp-client/src/mcp-connection-manager.ts"
# After connection manager:
Task: "Wire into gateway-start.ts"
```

---

## Implementation Strategy

### MVP First (US2 + US1)

1. Complete Phase 1: Setup (package scaffolding)
2. Complete Phase 2: Foundational (types + config layer)
3. Complete Phase 3: US2 — CLI Management (`mcp add/remove/list`)
4. Complete Phase 4: US1 — Agent MCP Tools (connection manager + gateway wiring)
5. **STOP and VALIDATE**: Configure a real MCP server, start gateway, test tool calling
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Config layer ready
2. Add US2 (CLI) → Users can manage MCP servers → Commit
3. Add US1 (Agent tools) → Agent can use MCP tools → Commit + Demo (MVP!)
4. Add US3 (Health) → Users can check server status → Commit
5. Polish → Documentation + coverage → Final commit

---

## Notes

- The `@ai-sdk/mcp` package uses `experimental_createMCPClient` — the import should alias this to `createMCPClient` for cleaner code
- Tool namespacing uses double underscore: `serverName__toolName`
- HTTP servers in config use `"type": "http"` but the AI SDK transport uses `type: 'sse'` — the transport factory handles this mapping
- The `enabled` field defaults to `true` when absent in the config
- Commit after each task or logical group following Conventional Commits
