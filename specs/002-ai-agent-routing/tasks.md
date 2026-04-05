# Tasks: Model Selection UX (Incremental)

**Input**: Design documents from `/specs/002-ai-agent-routing/`
**Prerequisites**: plan.md, spec.md, quickstart.md

**Tests**: TDD approach — write/update tests first per constitution.

**Organization**: Single user story (US1 enhancement). Sequential execution.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Include exact file paths in descriptions

## Phase 1: Data Update

**Purpose**: Expand the model lists that drive the selection UI

- [ ] T001 [P] [US1] Update provider-info test to verify expanded model lists in tests/unit/ai-agent/provider-info.test.ts
- [ ] T002 [P] [US1] Expand exampleModels arrays for all providers in packages/ai-agent/src/provider-info.ts — openai: add gpt-4o-mini, o3, o3-mini, o4-mini; anthropic: add claude-3-5-sonnet-20241022; google: add gemini-2.5-pro, gemini-2.5-flash; ollama: add llama3.1, gemma2, phi3, deepseek-r1

**Checkpoint**: Provider info data is expanded and tests pass

---

## Phase 2: Model Selection Implementation (US1 Enhancement)

**Goal**: Replace free-text model input with a selectable list of popular models per provider + custom fallback

**Independent Test**: Run `closeclaw agent configure`, select any provider, verify a list of models appears. Select "Custom (enter manually)" and verify free-text input works. Select a listed model and verify it is saved correctly.

### Tests

- [ ] T003 [US1] Update agent-configure tests to cover model selection list: mock `select` to return a listed model, verify it flows through to assembleAgent in tests/unit/cli/agent-configure.test.ts
- [ ] T004 [US1] Add test for "Custom (enter manually)" path: mock `select` to return sentinel value, then mock `input` for custom model name in tests/unit/cli/agent-configure.test.ts
- [ ] T005 [US1] Add test for custom provider (no model list): verify `input` is called directly without `select` in tests/unit/cli/agent-configure.test.ts

### Implementation

- [ ] T006 [US1] Widen `select` type in AgentConfigureDeps to accept `string` values (not just `AiProvider`) in packages/cli/src/commands/agent-configure-run.ts
- [ ] T007 [US1] Replace `promptModel(deps)` with `promptModel(deps, provider)` — build choices from PROVIDER_INFO[provider].exampleModels, append "Custom (enter manually)" sentinel, use select for providers with models, fall back to input for custom provider in packages/cli/src/commands/agent-configure-run.ts
- [ ] T008 [US1] Update the call site in `executeAgentConfigure` to pass `provider` to `promptModel` in packages/cli/src/commands/agent-configure-run.ts

**Checkpoint**: Model selection works for all providers, custom fallback works, all tests pass

---

## Phase 3: Polish & Validation

**Purpose**: Ensure everything is clean and passing

- [ ] T009 Run full test suite: `pnpm test`
- [ ] T010 Run coverage check: `pnpm test:coverage` (must meet ≥ 90% threshold)
- [ ] T011 Run lint and format: `pnpm lint && pnpm format:check`
- [ ] T012 Commit changes following Conventional Commits: `feat(cli): replace free-text model input with selectable model list`
- [ ] T013 Verify app end-to-end: `pnpm tsx packages/cli/src/index.ts agent configure`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Data Update)**: No dependencies — T001 and T002 can run in parallel
- **Phase 2 (Implementation)**: Depends on Phase 1 — T003-T005 (tests) before T006-T008 (code)
- **Phase 3 (Polish)**: Depends on Phase 2 completion

### Within Phase 2

- T003, T004, T005 (tests) → MUST be written first and FAIL
- T006 (type widening) → T007 (function rewrite) → T008 (call site update)
- T006 before T007 because the new `promptModel` uses `deps.select` with `string` values

### Parallel Opportunities

- T001 and T002 can run in parallel (different files)
- T003, T004, T005 can be written together (same test file, different test cases)

---

## Implementation Strategy

### Single Increment

1. Phase 1: Expand data (5 min)
2. Phase 2: Write tests → implement → verify (15 min)
3. Phase 3: Validate + commit (5 min)

Total estimated scope: ~50 lines changed across 4 files.
