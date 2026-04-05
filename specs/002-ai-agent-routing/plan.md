# Implementation Plan: Model Selection UX (Incremental)

**Branch**: `002-ai-agent-routing` | **Date**: 2026-04-05 | **Spec**: [spec.md](./spec.md)
**Input**: Clarification from spec — replace free-text model name input with selectable list of popular models per provider + "Custom (enter manually)" fallback.

## Summary

Replace the free-text `input` prompt for model name in `closeclaw agent configure` with a `select` prompt that presents popular models for the chosen provider. Add a "Custom (enter manually)" option at the end that falls back to free-text input. The `PROVIDER_INFO` data structure already contains `exampleModels` arrays — this change uses that existing data to drive the selection UI.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: @inquirer/prompts (`select`, `input`), @closeclaw/ai-agent (`PROVIDER_INFO`)
**Storage**: N/A (config persistence unchanged)
**Testing**: Vitest (unit tests with mocked prompts)
**Target Platform**: Node.js 22 LTS CLI
**Project Type**: CLI (monorepo package `@closeclaw/cli`)
**Performance Goals**: N/A (interactive CLI prompt)
**Constraints**: Functions ≤ 20 lines, files ≤ 200 lines, no comments, ≥ 90% coverage
**Scale/Scope**: 3 files changed (1 source, 1 test, 1 data update)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                | Status | Notes                                                    |
| ------------------------ | ------ | -------------------------------------------------------- |
| I. TDD                   | PASS   | Write/update tests before changing `promptModel`         |
| II. Clean Code           | PASS   | No comments, function stays ≤ 20 lines                   |
| III. Design Principles   | PASS   | KISS — reuse existing `PROVIDER_INFO.exampleModels` data |
| IV. Atomic Commits       | PASS   | Single commit for this focused change                    |
| V. Automation-First      | N/A    | UX improvement, not automation                           |
| VI. Modular Architecture | PASS   | Change scoped to `cli` package, data from `ai-agent`     |

## Project Structure

### Source Code (affected files only)

```text
packages/
  ai-agent/src/
    provider-info.ts          # UPDATE: expand exampleModels with more popular models
  cli/src/commands/
    agent-configure-run.ts    # UPDATE: replace promptModel with select-based picker
tests/
  unit/cli/
    agent-configure.test.ts   # UPDATE: test model selection list + custom fallback
  unit/ai-agent/
    provider-info.test.ts     # UPDATE: verify expanded model lists
```

## Design

### Current Behavior

`promptModel` in `agent-configure-run.ts` (line 66-71) uses `deps.input` to ask for a free-text model name:

```typescript
async function promptModel(deps: AgentConfigureDeps): Promise<string> {
  return deps.input({
    message: "Model name",
    validate: (v) => (v.trim().length > 0 ? true : "Required"),
  });
}
```

### New Behavior

1. After provider selection, build a choices array from `PROVIDER_INFO[provider].exampleModels`
2. Append a `{ name: "Custom (enter manually)", value: "__custom__" }` sentinel
3. If provider is `"custom"` (no predefined models), skip the select and go straight to free-text input
4. If user selects `"__custom__"`, prompt with free-text `input`
5. Otherwise, use the selected model string directly

### Updated `promptModel` Signature

```typescript
async function promptModel(
  deps: AgentConfigureDeps,
  provider: AiProvider,
): Promise<string>;
```

The function gains a `provider` parameter to look up the correct model list. The caller at line 173 changes from `promptModel(deps)` to `promptModel(deps, provider)`.

### Data: Expanded Model Lists

Update `PROVIDER_INFO` to include a broader set of popular models per provider:

| Provider  | Models                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------- |
| openai    | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo, o3, o3-mini, o4-mini                                   |
| anthropic | claude-sonnet-4-20250514, claude-opus-4-20250514, claude-3-5-haiku-20241022, claude-3-5-sonnet-20241022 |
| google    | gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-pro                                      |
| ollama    | llama3.2, llama3.1, mistral, codellama, gemma2, phi3, deepseek-r1                                       |
| kimi      | moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k                                                       |
| custom    | [] (empty — always free-text)                                                                           |

### AgentConfigureDeps Type Change

The `select` type in `AgentConfigureDeps` currently only accepts `AiProvider` as the value type. The model selector needs `string` values. Solution: make the `select` type generic or add a separate `selectModel` method. Simplest approach: widen the existing `select` to accept `string` value type, since `AiProvider` is already a `string`.

Alternatively, reuse the existing `select` by typing it as `(opts: { message: string; choices: { name: string; value: string }[] }) => Promise<string>` — which is a compatible widening since `AiProvider extends string`.

## Complexity Tracking

No complexity violations. Change is KISS: reuse existing data, single function update.
