# Implementation Plan: MCP Tool Integration

**Branch**: `006-mcp-tool-integration` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-mcp-tool-integration/spec.md`

## Summary

Enable the CloseClaw AI agent to discover and invoke tools from MCP (Model Context Protocol) servers during conversations. MCP server configurations are stored in `~/.closeclaw/mcp.json` (Cursor-compatible format). The gateway connects to configured servers at startup, discovers their tools, and registers them alongside built-in tools for the AI model to call. CLI commands (`closeclaw mcp add/remove/list/status`) manage the configuration.

**Technical approach**: Use `@ai-sdk/mcp` (v1.0.35) — the official Vercel AI SDK MCP adapter — which provides `createMCPClient()` with `.tools()` that converts MCP server tools into AI SDK-compatible tool objects. A new `packages/mcp-client` package encapsulates config loading, connection management, and tool discovery. MCP tools are injected via the existing `extraTools` mechanism in the message processor.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: `ai@^6.0.0`, `@ai-sdk/mcp@^1.0.35`, `@ai-sdk/provider@^3.0.0`, `zod@^3.25.76`, `commander`, `@inquirer/prompts`
**Storage**: JSON file (`~/.closeclaw/mcp.json`)
**Testing**: Vitest (unit + integration + contract)
**Target Platform**: Node.js 22 LTS (macOS/Linux)
**Project Type**: CLI tool + gateway server (pnpm monorepo)
**Performance Goals**: Gateway startup with 5 MCP servers completes within 30 seconds
**Constraints**: Graceful degradation — failed MCP servers must not block gateway startup
**Scale/Scope**: 1–15 MCP servers typical, each exposing 1–50 tools

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                     | Status | Notes                                                                      |
| ----------------------------- | ------ | -------------------------------------------------------------------------- |
| I. TDD (NON-NEGOTIABLE)       | PASS   | All code via Red-Green-Refactor; unit/integration/contract tests planned    |
| II. Clean Code (NON-NEGOTIABLE)| PASS  | No comments, functions ≤ 20 lines, files ≤ 200 lines, descriptive names    |
| III. Design Principles        | PASS   | DI for MCP client creation, composition for tool merging, adapter pattern   |
| IV. Atomic Commits            | PASS   | Each task = one commit, Conventional Commits format                         |
| V. Automation-First           | PASS   | MCP tools eliminate manual HTTP configuration for each service              |
| VI. Modular Architecture      | PASS   | New `packages/mcp-client` package with explicit boundaries                  |
| VII. Living Documentation     | PASS   | `docs/mcp-integration.md` + CLI reference update                            |
| Code Quality Standards        | PASS   | Strict TypeScript, input validation at boundaries, explicit error handling  |

**Post-Phase 1 Re-check**: All gates pass. The new `packages/mcp-client` package adds one dependency (`@ai-sdk/mcp`) which is the official adapter. No violations detected.

## Project Structure

### Documentation (this feature)

```text
specs/006-mcp-tool-integration/
├── plan.md                          # This file
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/
│   ├── mcp-config-schema.md         # Config file contract
│   └── cli-commands.md              # CLI command contracts
└── tasks.md                         # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── mcp-client/                      # NEW PACKAGE
│   ├── package.json
│   └── src/
│       ├── index.ts                 # Barrel exports
│       ├── mcp-config-types.ts      # McpServerConfig, McpConfigFile types
│       ├── mcp-config-loader.ts     # Load + validate ~/.closeclaw/mcp.json
│       ├── mcp-config-writer.ts     # Write config (add/remove servers)
│       ├── mcp-env-interpolator.ts  # ${env:VAR} resolution
│       ├── mcp-connection-manager.ts # Connect/disconnect/get tools
│       └── mcp-transport-factory.ts # Create stdio/http transports from config
├── ai-agent/
│   └── src/
│       └── (no changes — MCP tools injected via existing extraTools)
├── cli/
│   └── src/
│       ├── cli.ts                   # Add: registerMcpCommands(program, deps)
│       └── commands/
│           ├── mcp-registry.ts      # NEW: register mcp command group
│           ├── mcp-add.ts           # NEW: closeclaw mcp add <name>
│           ├── mcp-remove.ts        # NEW: closeclaw mcp remove <name>
│           ├── mcp-list.ts          # NEW: closeclaw mcp list
│           ├── mcp-status.ts        # NEW: closeclaw mcp status
│           └── gateway-start.ts     # MODIFIED: MCP connect at startup
├── shared-types/
│   └── src/
│       └── (no changes — MCP types live in mcp-client package)
├── gateway/
│   └── (no changes)
└── bot-adapters/
    └── (no changes)

tests/
├── unit/
│   └── mcp-client/
│       ├── mcp-config-loader.test.ts
│       ├── mcp-config-writer.test.ts
│       ├── mcp-env-interpolator.test.ts
│       ├── mcp-connection-manager.test.ts
│       └── mcp-transport-factory.test.ts
├── integration/
│   └── mcp-gateway-flow.test.ts
└── contract/
    └── mcp-config-schema.test.ts

docs/
└── mcp-integration.md               # NEW: user-facing docs
```

**Structure Decision**: New `packages/mcp-client` package follows the monorepo's one-concern-per-package pattern. The CLI package depends on `@closeclaw/mcp-client` for config operations and connection management. Gateway startup in the CLI orchestrates MCP connection and passes discovered tools to the agent via `extraTools`.

## Complexity Tracking

No constitution violations to justify. All design choices align with established patterns.
