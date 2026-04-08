# Research: MCP Tool Integration

**Feature**: `006-mcp-tool-integration`
**Date**: 2026-04-08

## R-001: MCP Client Library for AI SDK

**Question**: How do we bridge MCP servers into the Vercel AI SDK `generateText` tool system?

**Decision**: Use `@ai-sdk/mcp` (v1.0.35) — the official Vercel AI SDK MCP adapter package.

**Rationale**: This package provides `createMCPClient()` which returns a client with a `.tools()` method that converts MCP server tools directly into AI SDK-compatible tool objects. These tools can be spread into the `tools` parameter of `generateText` alongside existing built-in tools. The package also provides `StdioMCPTransport` via the `@ai-sdk/mcp/mcp-stdio` subpath for local stdio-based MCP servers.

**Alternatives Considered**:

- `@modelcontextprotocol/sdk` (v1.29.0): The official MCP TypeScript SDK. Provides `Client`, `StdioClientTransport`, and `StreamableHTTPClientTransport`. Would require writing a custom bridge to convert MCP tool schemas (JSON Schema) to AI SDK tool format (Zod or JSON Schema with execute wrapper). More control but significantly more code. Rejected because `@ai-sdk/mcp` does this bridging automatically.
- Manual JSON-RPC 2.0 implementation: Maximum control but reinvents the wheel. Rejected as unnecessary complexity.

## R-002: MCP Transport Types

**Question**: What transport mechanisms must we support for connecting to MCP servers?

**Decision**: Support two transports:

1. **Stdio** — for local process-based MCP servers (the most common pattern). The server runs as a child process, communicating via stdin/stdout. Uses `StdioMCPTransport` from `@ai-sdk/mcp/mcp-stdio`.
2. **HTTP (Streamable HTTP / SSE)** — for remote or HTTP-based MCP servers. Uses the SSE transport config `{ type: 'sse', url, headers }` from `@ai-sdk/mcp` or `StreamableHTTPClientTransport` from `@modelcontextprotocol/sdk/client/streamableHttp`.

**Rationale**: The user's existing Cursor `mcp.json` contains exclusively HTTP-type servers (Jira, Confluence, Jenkins, Datadog, Bitbucket), all using `"type": "http"` with URLs like `http://localhost:8000/mcp`. However, the broader MCP ecosystem primarily uses stdio (e.g., `npx @modelcontextprotocol/server-filesystem`). Supporting both ensures compatibility with the user's existing setup and the wider ecosystem.

**Note**: The AI SDK SSE transport accepts `{ type: 'sse', url, headers }` as a plain config object, which maps cleanly to the user's HTTP-type servers. For stdio, the `StdioMCPTransport` class from `@ai-sdk/mcp/mcp-stdio` takes `{ command, args, env }`.

## R-003: Configuration File Format

**Question**: What should `~/.closeclaw/mcp.json` look like?

**Decision**: Mirror the Cursor `mcp.json` format with one extension (an `enabled` flag).

```json
{
  "mcpServers": {
    "server-name": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "env": { "API_KEY": "value" },
      "enabled": true
    },
    "another-server": {
      "type": "http",
      "url": "http://localhost:8000/mcp",
      "headers": { "Authorization": "Bearer token" },
      "enabled": true
    }
  }
}
```

**Rationale**: Cursor's format is the de facto standard. Using the same structure means users can copy server entries between their Cursor and CloseClaw configs. The `enabled` flag (defaulting to `true` when absent) allows temporarily disabling a server without removing its config. Environment variable interpolation (`${env:VAR_NAME}`) is supported for header values to match Cursor's behavior.

**Alternatives Considered**:

- Flat array format: Rejected because the keyed-object format (server name as key) is more ergonomic for lookups and matches Cursor's standard.
- Separate files per server: Rejected as unnecessary complexity.

## R-004: Environment Variable Interpolation

**Question**: How should we handle `${env:VAR_NAME}` syntax in config values?

**Decision**: Implement simple string interpolation that replaces `${env:VAR_NAME}` with `process.env.VAR_NAME`. Apply this to header values and env object values at config load time.

**Rationale**: The user's existing Cursor `mcp.json` uses this pattern extensively (e.g., `"Authorization": "Token ${env:MCP_JIRA_TOKEN}"`). Matching this behavior ensures configuration portability.

## R-005: Tool Namespacing Strategy

**Question**: How should MCP tools be namespaced to avoid collisions with built-in tools?

**Decision**: All MCP tools are registered with a `serverName__toolName` prefix (double underscore separator). For example, a tool `search_issues` from server `jira` becomes `jira__search_issues`. Built-in tools (datetime, http_request, shell_execute) are never namespaced and always take precedence.

**Rationale**: Double underscore is unlikely to appear in either server names or tool names, making it a safe separator. The AI model sees the full namespaced name in the tool list and can call it naturally. The description from the MCP server is preserved, so the model understands what each tool does.

**Alternatives Considered**:

- Colon separator (`jira:search_issues`): Colons can conflict with JSON Schema `$ref` notation. Rejected.
- No namespacing with collision detection: Would require complex conflict resolution. Rejected.

## R-006: Connection Lifecycle and Error Handling

**Question**: When should MCP connections be established and how should failures be handled?

**Decision**:

1. **Startup**: Connect to all enabled MCP servers during gateway startup (after adapter connection, before server.start). Connect in parallel with a per-server timeout (10 seconds). Log each server's status.
2. **Failure at startup**: Log warning, skip the server, continue with remaining servers.
3. **Failure during tool call**: The MCP client/transport will throw. The AI SDK's tool execution wraps this error and returns it to the model, which can explain the failure to the user.
4. **Shutdown**: Close all MCP clients during gateway shutdown (in the `finally` block).

**Rationale**: Parallel startup with graceful degradation ensures one bad server doesn't block the entire gateway. The AI model is good at explaining tool failures to users when it receives error results.

## R-007: Package Placement

**Question**: Which package should the MCP client logic live in?

**Decision**: New package `packages/mcp-client` that depends on `@ai-sdk/mcp`, `@ai-sdk/provider`, `@closeclaw/shared-types`, and `zod`. The CLI package will depend on `@closeclaw/mcp-client` to connect during gateway startup and for the `closeclaw mcp` commands.

**Rationale**: Following the monorepo's modular architecture (Constitution VI), MCP client logic is a distinct concern from AI agent logic, bot adapters, and gateway routing. It has its own dependencies (`@ai-sdk/mcp`) and its own lifecycle. Keeping it in a separate package maintains clean boundaries.

**Alternatives Considered**:

- Add to `ai-agent` package: Would bloat the agent package with MCP transport concerns. Rejected.
- Add to `cli` package: Would mix infrastructure logic with CLI presentation. Rejected.

## R-008: AI SDK MCP API Usage Pattern

**Question**: How exactly does `@ai-sdk/mcp`'s `createMCPClient` work?

**Decision**: Based on the AI SDK documentation:

```typescript
import { experimental_createMCPClient as createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport as StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";

// Stdio transport
const stdioClient = await createMCPClient({
  transport: new StdioMCPTransport({
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
    env: { API_KEY: "value" },
  }),
});

// SSE/HTTP transport
const httpClient = await createMCPClient({
  transport: {
    type: "sse",
    url: "http://localhost:8000/mcp",
    headers: { Authorization: "Bearer token" },
  },
});

// Get AI SDK tools (auto-discovers and converts)
const tools = await stdioClient.tools();

// Use in generateText
const result = await generateText({
  model,
  tools: { ...builtInTools, ...tools },
  prompt: "...",
});

// Cleanup
await stdioClient.close();
```

The `.tools()` method returns a `Record<string, Tool>` compatible with the AI SDK's `generateText` `tools` parameter.

## R-009: CLI Command Design

**Question**: What should the CLI commands look like?

**Decision**:

- `closeclaw mcp add <name>` — interactive prompts for transport type, connection details
- `closeclaw mcp remove <name>` — removes server from config
- `closeclaw mcp list` — displays table of configured servers
- `closeclaw mcp status` — connects to each server, shows health + tool count

The `mcp` command group follows the same pattern as `cron` and `heartbeat` registries.
