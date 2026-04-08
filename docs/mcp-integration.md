# MCP Tool Integration

CloseClaw can discover and use tools from external MCP (Model
Context Protocol) servers. This lets the AI agent call tools
provided by services like Jira, Confluence, Datadog, Bitbucket,
or any MCP-compatible server.

## How It Works

1. Configure MCP servers in `~/.closeclaw/mcp.json`
2. Start the gateway — it connects to each server and discovers
   available tools
3. The AI model can call MCP tools during conversations just
   like built-in tools

```text
User Message → AI Agent → MCP Tool Call → MCP Server → Response
```

## Configuration

MCP servers are configured in `~/.closeclaw/mcp.json`. The format
mirrors Cursor's `mcp.json` for easy portability.

### HTTP Servers

```json
{
  "mcpServers": {
    "jira": {
      "type": "http",
      "url": "http://localhost:8000/mcp",
      "headers": {
        "Authorization": "Token ${env:MCP_JIRA_TOKEN}"
      }
    }
  }
}
```

### Stdio Servers

```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "env": {
        "API_KEY": "${env:MY_KEY}"
      }
    }
  }
}
```

### Environment Variable Interpolation

Use `${env:VAR_NAME}` in header values, env values, or URLs.
The variable is resolved from the host's environment at config
load time. Missing variables produce a warning and resolve to
an empty string.

### Enabling and Disabling

Add `"enabled": false` to temporarily disable a server without
removing its configuration. Servers without the `enabled` field
default to `true`.

## CLI Commands

### Add a Server

```bash
closeclaw mcp add my-server
```

Interactive prompts ask for transport type (stdio or http),
connection details, and optional environment variables.

### Remove a Server

```bash
closeclaw mcp remove my-server
```

### List Configured Servers

```bash
closeclaw mcp list
```

Displays a table showing name, type, URL/command, and enabled
status for all configured MCP servers.

### Check Server Health

```bash
closeclaw mcp status
```

Connects to each configured server, reports connection status
and discovered tool count, then disconnects.

## Gateway Startup Behavior

When the gateway starts with MCP servers configured:

1. Loads `~/.closeclaw/mcp.json`
2. Filters out disabled servers
3. Connects to all enabled servers in parallel (10-second timeout
   per server)
4. Logs each server's status and tool count
5. Merges discovered tools into the AI agent's tool set

Failed servers are logged as warnings but do not block gateway
startup. The AI agent continues to function with the tools from
successfully connected servers plus all built-in tools.

## Tool Namespacing

MCP tools are namespaced with their server name to prevent
collisions: `serverName__toolName`. For example, a tool called
`search_issues` from the `jira` server becomes `jira__search_issues`.

Built-in tools (datetime, http_request, shell_execute) are never
namespaced and always take precedence.

## Troubleshooting

**Server shows "failed" in status:**
Verify the server is running and accessible. For HTTP servers,
check the URL and any authentication headers. For stdio servers,
check that the command is installed and executable.

**Environment variable not resolved:**
Ensure the variable is set in the shell environment where the
gateway runs. Check for typos in the `${env:VAR_NAME}` syntax.

**Tools not appearing in AI responses:**
Confirm the server is listed as "connected" in gateway startup
logs. The AI model discovers tools automatically; try asking
it to list available tools.
