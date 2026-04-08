# Contract: MCP Configuration File Schema

**File**: `~/.closeclaw/mcp.json`

## Schema

```json
{
  "mcpServers": {
    "<server-name>": {
      "type": "stdio" | "http",
      "command": "<string>",
      "args": ["<string>", ...],
      "env": { "<key>": "<value>", ... },
      "url": "<string>",
      "headers": { "<key>": "<value>", ... },
      "enabled": true | false
    }
  }
}
```

## Type: stdio

Required fields: `type`, `command`
Optional fields: `args`, `env`, `enabled`

```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/Desktop"],
      "enabled": true
    }
  }
}
```

## Type: http

Required fields: `type`, `url`
Optional fields: `headers`, `enabled`

```json
{
  "mcpServers": {
    "jira": {
      "type": "http",
      "url": "http://localhost:8000/mcp",
      "headers": {
        "Authorization": "Token ${env:MCP_JIRA_TOKEN}"
      },
      "enabled": true
    }
  }
}
```

## Environment Variable Interpolation

Header values and env values support `${env:VAR_NAME}` syntax. At load time, these are replaced with the corresponding `process.env.VAR_NAME` value. If the variable is not set, the placeholder is replaced with an empty string and a warning is logged.

## CLI Commands

### `closeclaw mcp add <name>`

Interactive prompts:

1. Transport type: `stdio` or `http`
2. For stdio: `command`, `args` (comma-separated), optional `env` key-value pairs
3. For http: `url`, optional `headers` key-value pairs
4. If `<name>` already exists: confirm replacement

Writes to `~/.closeclaw/mcp.json`, creating the file if it doesn't exist.

### `closeclaw mcp remove <name>`

Removes the named server from `~/.closeclaw/mcp.json`. Prints error if name not found.

### `closeclaw mcp list`

Displays a table:

```
Name              Type    URL/Command                          Enabled
--------------------------------------------------------------------------------
jira              http    http://localhost:8000/mcp             yes
filesystem        stdio   npx -y @modelcontextprotocol/...     yes
```

### `closeclaw mcp status`

Connects to each enabled server, discovers tools, then disconnects. Displays:

```
Name              Status       Tools  Error
--------------------------------------------------------------------------------
jira              connected    12     —
filesystem        connected    5      —
broken-server     failed       0      Connection refused
```
