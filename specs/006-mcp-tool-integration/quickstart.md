# Quickstart: MCP Tool Integration

## Prerequisites

- CloseClaw installed and onboarded (`closeclaw onboard` completed)
- AI agent configured (`closeclaw agent configure` completed)
- An MCP server available (either a local npm package or an HTTP server)

## Add an MCP Server

### HTTP Server (e.g., Jira)

```bash
closeclaw mcp add jira
# Prompts:
#   Transport type: http
#   URL: http://localhost:8000/mcp
#   Headers: Authorization=Token YOUR_TOKEN_HERE
```

### Stdio Server (e.g., Filesystem)

```bash
closeclaw mcp add filesystem
# Prompts:
#   Transport type: stdio
#   Command: npx
#   Arguments: -y,@modelcontextprotocol/server-filesystem,/Users/me/Desktop
```

## Verify Configuration

```bash
closeclaw mcp list
# Output:
# Name              Type    URL/Command                          Enabled
# jira              http    http://localhost:8000/mcp             yes
# filesystem        stdio   npx -y @modelcontextprotocol/...     yes
```

## Check Server Health

```bash
closeclaw mcp status
# Output:
# Name              Status       Tools  Error
# jira              connected    12     —
# filesystem        connected    5      —
```

## Start the Gateway

```bash
closeclaw gateway start
# Output:
# AI agent active: anthropic/claude-sonnet-4-6
# [mcp] jira: connected (12 tools)
# [mcp] filesystem: connected (5 tools)
# Gateway running. Press Ctrl+C to stop.
```

## Use MCP Tools in Conversation

Send a message to your bot:

> "Fetch my open Jira issues"

The agent will automatically discover the Jira MCP tools and call `jira__search_issues` (or similar) to fetch your issues.

## Remove an MCP Server

```bash
closeclaw mcp remove jira
```

## Manual Configuration

You can also edit `~/.closeclaw/mcp.json` directly:

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

The `${env:VAR_NAME}` syntax reads from environment variables at startup.
