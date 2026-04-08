# Feature Specification: MCP Tool Integration

**Feature Branch**: `006-mcp-tool-integration`
**Created**: 2026-04-08
**Status**: Draft
**Input**: User description: "The agent should be able to use MCP tools provided by configured MCP servers. Discovery from ~/.closeclaw/mcp.json config file. CLI commands closeclaw mcp add and closeclaw mcp remove for managing servers."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Agent Uses MCP Tools During Conversation (Priority: P1)

A user has configured one or more MCP servers (e.g., Jira, Bitbucket, Datadog) in their CloseClaw configuration. When the user asks the agent a question that requires an external tool — like "fetch my open Jira issues" or "check Datadog alerts" — the agent automatically discovers the available MCP tools and calls them directly, rather than relying on raw HTTP requests that the user would have to configure manually.

The agent treats MCP tools as first-class tools alongside the existing built-in tools (datetime, http_request, shell_execute). When the gateway starts, it reads the MCP configuration, connects to the configured servers, discovers their available tools, and registers them so the AI model can invoke them during conversations.

**Why this priority**: This is the core value proposition — the agent can interact with any service that exposes an MCP server, dramatically expanding its capabilities without custom tool development for each integration.

**Independent Test**: Configure a single MCP server (e.g., a simple test server that returns static data). Start the gateway. Ask the agent a question that requires calling that server's tool. Verify the agent discovers and calls the tool, then returns the result to the user.

**Acceptance Scenarios**:

1. **Given** the user has configured an MCP server in `~/.closeclaw/mcp.json`, **When** the gateway starts, **Then** the agent connects to the server and discovers its available tools.
2. **Given** the agent has discovered MCP tools, **When** the user asks a question that requires an MCP tool, **Then** the agent calls the appropriate tool and includes the result in its response.
3. **Given** an MCP server is unreachable at gateway startup, **When** the agent attempts to connect, **Then** it logs a warning and continues operating with remaining tools (graceful degradation).
4. **Given** an MCP tool call fails during a conversation, **When** the error occurs, **Then** the agent informs the user and suggests alternatives.

---

### User Story 2 - Managing MCP Servers via CLI (Priority: P1)

A user wants to add or remove MCP server configurations without manually editing JSON files. They use CLI commands like `closeclaw mcp add <server-name>` and `closeclaw mcp remove <server-name>` to manage their MCP server list. The CLI prompts for the necessary connection details (command to run for stdio servers, or URL for HTTP servers) and writes the configuration to `~/.closeclaw/mcp.json`.

The user can also list all configured servers with `closeclaw mcp list` to see what's currently set up.

**Why this priority**: Equal to P1 because without a way to configure servers, the agent can't use them. The CLI is the primary interface for setup.

**Independent Test**: Run `closeclaw mcp add test-server`, provide connection details when prompted, then verify the server appears in `~/.closeclaw/mcp.json`. Run `closeclaw mcp remove test-server` and verify it's gone. Run `closeclaw mcp list` and verify the output matches the config file.

**Acceptance Scenarios**:

1. **Given** no MCP servers are configured, **When** the user runs `closeclaw mcp add my-server`, **Then** the CLI prompts for connection details and creates `~/.closeclaw/mcp.json` with the new server entry.
2. **Given** an MCP server is configured, **When** the user runs `closeclaw mcp remove my-server`, **Then** the server is removed from the configuration file.
3. **Given** one or more MCP servers are configured, **When** the user runs `closeclaw mcp list`, **Then** a table showing server names, connection types, and status is displayed.
4. **Given** the user tries to add a server with a name that already exists, **When** the command runs, **Then** the user is asked whether to replace the existing configuration.

---

### User Story 3 - MCP Server Health Visibility (Priority: P2)

When the gateway is running, the user wants to know which MCP servers are connected and healthy. The gateway startup output shows the status of each configured MCP server (connected, failed, number of tools discovered). The user can also check server health at any time via `closeclaw mcp status`.

**Why this priority**: Useful for debugging but not essential for the core MCP functionality to work.

**Independent Test**: Configure two MCP servers (one reachable, one unreachable). Start the gateway. Verify the startup output shows one connected and one failed. Run `closeclaw mcp status` and verify consistent output.

**Acceptance Scenarios**:

1. **Given** the gateway is starting with configured MCP servers, **When** connection attempts complete, **Then** the startup log shows each server's name, connection status, and tool count.
2. **Given** the gateway is running, **When** the user runs `closeclaw mcp status`, **Then** a summary of all configured servers with their current health is displayed.
3. **Given** an MCP server disconnects while the gateway is running, **When** the agent tries to call one of its tools, **Then** the agent reports the server is unavailable and handles the failure gracefully.

---

### Edge Cases

- What happens when `~/.closeclaw/mcp.json` does not exist? The agent starts with no MCP tools available and operates normally with built-in tools only.
- What happens when `~/.closeclaw/mcp.json` is malformed? The gateway logs a warning with the parse error and starts without MCP tools.
- What happens when an MCP server exposes a tool with the same name as a built-in tool? Built-in tools take precedence; the MCP tool is registered with a namespaced name (e.g., `jira:search_issues`).
- What happens when an MCP server goes down mid-conversation? The agent receives an error from the tool call, explains the failure to the user, and continues the conversation.
- What happens when the user adds a server while the gateway is running? The new server is available on next gateway restart. Live hot-reload is out of scope for v1.
- What happens when an MCP server requires environment variables (e.g., API keys)? The configuration supports specifying environment variables that are passed to the server process at launch.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST read MCP server configurations from `~/.closeclaw/mcp.json` at gateway startup.
- **FR-002**: The system MUST connect to each configured MCP server and discover its available tools.
- **FR-003**: Discovered MCP tools MUST be registered as callable tools for the AI model alongside existing built-in tools.
- **FR-004**: The AI agent MUST be able to invoke MCP tools during conversation and include results in its response.
- **FR-005**: MCP tools MUST be namespaced by server name to avoid collisions (e.g., `jira:search_issues`).
- **FR-006**: Built-in tools MUST take precedence over MCP tools in case of name conflicts.
- **FR-007**: The system MUST support MCP servers that connect via local process (stdio transport) — the most common pattern for MCP servers.
- **FR-008**: The system MUST support MCP servers that connect via HTTP (Streamable HTTP transport).
- **FR-009**: The `closeclaw mcp add <name>` command MUST prompt for connection type and details, then write to `~/.closeclaw/mcp.json`.
- **FR-010**: The `closeclaw mcp remove <name>` command MUST remove the named server from the configuration file.
- **FR-011**: The `closeclaw mcp list` command MUST display all configured servers with their connection type.
- **FR-012**: The `closeclaw mcp status` command MUST show the health and tool count of each configured server (requires a running gateway or live connection attempt).
- **FR-013**: The system MUST handle MCP server connection failures gracefully — log a warning and continue with remaining servers.
- **FR-014**: The system MUST handle MCP tool invocation failures gracefully — the agent reports the error and continues the conversation.
- **FR-015**: The MCP configuration MUST support specifying environment variables to pass to server processes.
- **FR-016**: The configuration file format MUST be compatible with the standard MCP configuration format used by other tools (similar structure to Cursor's `mcp.json`).

### Key Entities

- **MCP Server Configuration**: A named entry defining how to connect to an MCP server — includes server name, transport type (stdio or HTTP), connection command or URL, optional environment variables, and enabled/disabled flag.
- **MCP Tool**: A tool discovered from a connected MCP server — includes the server it belongs to, tool name, description, and input schema. Registered with the AI model as a namespaced callable tool.
- **MCP Connection**: A live connection to an MCP server — tracks connection status, discovered tools, and handles tool invocation requests from the AI agent.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can configure an MCP server and have the agent use its tools within 5 minutes of setup.
- **SC-002**: The agent successfully discovers and registers tools from all healthy configured MCP servers at startup with zero manual tool registration.
- **SC-003**: MCP tool calls complete and return results to the user within the same response flow as built-in tool calls — no additional user action required.
- **SC-004**: Adding or removing an MCP server via CLI takes under 30 seconds.
- **SC-005**: Gateway startup with 5 configured MCP servers completes within 30 seconds (including connection and discovery).
- **SC-006**: If an MCP server is unavailable, the agent continues operating with all other tools — zero downtime for the user.
- **SC-007**: 100% of existing built-in tool functionality continues working unchanged after MCP integration.

## Assumptions

- The user's machine has the MCP server binaries or packages already installed (e.g., `npx @modelcontextprotocol/server-jira`). CloseClaw does not install MCP servers — it only connects to them.
- MCP servers follow the standard MCP protocol (JSON-RPC 2.0 over stdio or HTTP). Non-standard servers are out of scope.
- Live hot-reload of MCP configuration changes is out of scope for v1. The gateway must be restarted to pick up changes.
- The `mcp.json` configuration format follows the de facto standard established by Cursor and other MCP-compatible tools, ensuring users can share configurations across tools.
- MCP server authentication (API keys, tokens) is handled via environment variables passed to the server process, not managed by CloseClaw directly.
- MCP resources and prompts (the other two MCP primitives besides tools) are out of scope for v1. Only tool discovery and invocation are supported.
