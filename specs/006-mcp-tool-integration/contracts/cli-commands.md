# Contract: CLI Commands for MCP Management

## Command Group: `closeclaw mcp`

### `closeclaw mcp add <name>`

**Arguments**: `name` (string, required) — server identifier

**Interactive Prompts**:

| Step | Prompt                      | Type    | Options/Validation          |
| ---- | --------------------------- | ------- | --------------------------- |
| 1    | Transport type              | select  | `stdio`, `http`             |
| 2a   | Command (stdio only)        | input   | non-empty string            |
| 2b   | Arguments (stdio only)      | input   | comma-separated, optional   |
| 2c   | Environment vars (stdio)    | input   | KEY=VALUE pairs, optional   |
| 3a   | URL (http only)             | input   | valid URL                   |
| 3b   | Headers (http only)         | input   | KEY=VALUE pairs, optional   |
| 4    | Replace existing? (if dup)  | confirm | yes/no                      |

**Exit codes**: 0 on success, 1 on error

**Side effects**: Writes to `~/.closeclaw/mcp.json`

---

### `closeclaw mcp remove <name>`

**Arguments**: `name` (string, required) — server to remove

**Output**: Success message or "Server not found" error

**Exit codes**: 0 on success, 1 if not found

**Side effects**: Updates `~/.closeclaw/mcp.json`

---

### `closeclaw mcp list`

**Arguments**: none

**Output**: Table with columns: Name, Type, URL/Command, Enabled

**Exit codes**: 0 always (empty table if no servers)

**Side effects**: none (read-only)

---

### `closeclaw mcp status`

**Arguments**: none

**Output**: Table with columns: Name, Status, Tools, Error

**Behavior**: Connects to each enabled server, discovers tools, disconnects. Disabled servers show status "disabled".

**Exit codes**: 0 always

**Side effects**: Temporary MCP connections (cleaned up before exit)
