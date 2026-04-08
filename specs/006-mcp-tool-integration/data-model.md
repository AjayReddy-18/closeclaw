# Data Model: MCP Tool Integration

**Feature**: `006-mcp-tool-integration`

## Entities

### McpServerConfig

Represents a single MCP server entry in the configuration file.

| Field     | Type                     | Required | Default | Description                                          |
| --------- | ------------------------ | -------- | ------- | ---------------------------------------------------- |
| name      | string                   | yes      | —       | Server name (the key in the mcpServers object)       |
| type      | `"stdio"` \| `"http"`    | yes      | —       | Transport mechanism                                  |
| command   | string                   | stdio    | —       | Executable command (e.g., `npx`, `node`)             |
| args      | string[]                 | no       | `[]`    | Command arguments                                    |
| env       | Record<string, string>   | no       | `{}`    | Environment variables for the server process         |
| url       | string                   | http     | —       | Server URL (e.g., `http://localhost:8000/mcp`)       |
| headers   | Record<string, string>   | no       | `{}`    | HTTP headers (supports `${env:VAR}` interpolation)   |
| enabled   | boolean                  | no       | `true`  | Whether the server is active                         |

Discriminated union on `type`:

- When `type === "stdio"`: `command` is required, `url`/`headers` are ignored
- When `type === "http"`: `url` is required, `command`/`args` are ignored

### McpConfigFile

Top-level structure of `~/.closeclaw/mcp.json`.

| Field      | Type                                  | Required | Description                        |
| ---------- | ------------------------------------- | -------- | ---------------------------------- |
| mcpServers | Record<string, McpServerConfigEntry>  | yes      | Map of server name → server config |

`McpServerConfigEntry` is the raw JSON shape (without the derived `name` field).

### McpConnection

Runtime state of a connected MCP server (not persisted).

| Field       | Type                       | Description                                        |
| ----------- | -------------------------- | -------------------------------------------------- |
| serverName  | string                     | Matches the config key                             |
| status      | `"connected"` \| `"failed"` \| `"closed"` | Connection state                  |
| toolCount   | number                     | Number of tools discovered                         |
| tools       | Record<string, Tool>       | AI SDK tool objects (namespaced keys)              |
| client      | MCPClient                  | Reference to the AI SDK MCP client for cleanup     |
| error       | string \| undefined        | Error message if connection failed                 |

### McpConnectionManager

Manages the full lifecycle of all MCP connections.

| Method          | Signature                                         | Description                                        |
| --------------- | ------------------------------------------------- | -------------------------------------------------- |
| connectAll      | `(configs: McpServerConfig[]) => Promise<McpConnectionResult[]>` | Connect to all servers in parallel |
| getAllTools      | `() => Record<string, Tool>`                      | Merged tool map from all connected servers          |
| getStatus       | `() => McpConnectionStatus[]`                     | Status of each server                              |
| closeAll        | `() => Promise<void>`                             | Disconnect all clients                             |

### McpConnectionResult

Returned from connectAll for each server.

| Field       | Type                   | Description                     |
| ----------- | ---------------------- | ------------------------------- |
| serverName  | string                 | Server name from config         |
| status      | `"connected"` \| `"failed"` | Outcome                    |
| toolCount   | number                 | Tools discovered (0 if failed)  |
| toolNames   | string[]               | List of namespaced tool names   |
| error       | string \| undefined    | Error message if failed         |

### McpConnectionStatus

Used by `closeclaw mcp status` and startup logging.

| Field       | Type                              | Description              |
| ----------- | --------------------------------- | ------------------------ |
| serverName  | string                            | Server name              |
| status      | `"connected"` \| `"failed"` \| `"closed"` | Current state  |
| toolCount   | number                            | Discovered tool count    |
| error       | string \| undefined               | Error if applicable      |

## State Transitions

### MCP Connection Lifecycle

```
[gateway start]
  → loadConfig() → McpServerConfig[]
  → connectAll(configs)
    → per server: createMCPClient(transport) → client.tools()
      → success: status = "connected", tools registered
      → failure: status = "failed", warning logged, continue
  → merge all tools into extraTools for message processor

[during conversation]
  → model calls MCP tool → tool.execute() invokes MCP server
    → success: result returned to model
    → failure: error returned to model, model explains to user

[gateway shutdown]
  → closeAll() → per server: client.close()
    → status = "closed"
```

## Validation Rules

### McpServerConfig Validation

- `name`: non-empty string, alphanumeric + hyphens only
- `type`: must be `"stdio"` or `"http"`
- When `type === "stdio"`: `command` must be a non-empty string
- When `type === "http"`: `url` must be a valid URL string
- `enabled`: boolean, defaults to `true` if absent
- `args`: array of strings if present
- `env`: object with string keys and string values if present
- `headers`: object with string keys and string values if present

### McpConfigFile Validation

- Must parse as valid JSON
- Must have an `mcpServers` key that is a non-null object
- Each value under `mcpServers` must be a valid `McpServerConfigEntry`
- Duplicate server names are impossible (object keys are unique)

## Relationships

```
McpConfigFile  ─── 1:N ──→  McpServerConfig
McpServerConfig  ─── 1:1 ──→  McpConnection (at runtime)
McpConnectionManager  ─── 1:N ──→  McpConnection
McpConnection  ─── 1:N ──→  AI SDK Tool (namespaced)
```

## Integration Points

### Existing: message-processor.ts

The `extraTools` parameter in `createMessageProcessor` already supports injecting additional tools beyond the built-in set. MCP tools will be passed through this same mechanism — merged with scheduler tools.

### Existing: gateway-start.ts

The `runGatewayStart` function orchestrates startup. MCP connection will happen after config loading and before `assembleAgent`, so the discovered tools can be passed as `extraTools`.

### Existing: cli.ts

A new `mcp` command group will be registered alongside `cron` and `heartbeat`, following the same registry pattern.
