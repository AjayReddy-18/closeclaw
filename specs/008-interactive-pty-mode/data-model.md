# Data Model: Interactive PTY Mode

## Entities

### PtySession

Represents an active PTY process running Cursor CLI.

| Field | Type | Description |
| --- | --- | --- |
| process | IPty | node-pty process handle |
| outputBuffer | string[] | Accumulated stripped output lines |
| state | "running" / "waiting_permission" / "completed" / "failed" | Current lifecycle state |
| createdAt | number | Timestamp (Date.now) |

### PtySpawnOptions

Configuration for spawning a PTY process.

| Field | Type | Description |
| --- | --- | --- |
| binary | string | Absolute path to cursor-agent |
| args | string[] | CLI arguments |
| cwd | string | Working directory |
| cols | number | Terminal width (default: 120) |
| rows | number | Terminal height (default: 40) |
| env | Record<string, string> | Environment variables (inherits process.env) |

### ProgressEvent

A parsed, human-readable progress update extracted from PTY output.

| Field | Type | Description |
| --- | --- | --- |
| type | "text" / "tool" / "status" | Category of progress |
| content | string | The message to show the user |
| timestamp | number | When the event was parsed |

### PermissionPrompt

A detected permission request from Cursor's interactive output.

| Field | Type | Description |
| --- | --- | --- |
| rawText | string | The original prompt text (after ANSI strip) |
| displayText | string | Cleaned text suitable for Telegram |
| detectedAt | number | Timestamp |
| responseSent | boolean | Whether user has responded |

### InteractiveTaskResult

Extends the existing `TaskResult` with interactive-mode specifics.

| Field | Type | Description |
| --- | --- | --- |
| sessionId | string | Cursor session/chat ID (if captured) |
| status | "completed" / "failed" / "timed_out" / "cancelled" | Outcome |
| summary | string | Final summary extracted from output |
| outputLog | string[] | All stripped output lines |
| permissionsRequested | number | Count of permission prompts shown |
| permissionsAccepted | number | Count of user-accepted prompts |
| permissionsDenied | number | Count of user-denied or timed-out prompts |

## State Transitions

```text
IDLE → RUNNING → WAITING_PERMISSION → RUNNING → COMPLETED
                                     ↘ RUNNING → FAILED
        RUNNING → COMPLETED
        RUNNING → FAILED
        RUNNING → TIMED_OUT
```

- **IDLE → RUNNING**: PTY spawned, output streaming begins
- **RUNNING → WAITING_PERMISSION**: Permission prompt detected, awaiting user
- **WAITING_PERMISSION → RUNNING**: User responded (accept/deny), keystroke sent
- **WAITING_PERMISSION → RUNNING**: Auto-deny after timeout (2 min)
- **RUNNING → COMPLETED**: PTY process exits with code 0
- **RUNNING → FAILED**: PTY process exits with non-zero code
- **RUNNING → TIMED_OUT**: Session timeout reached, process killed

## Relationships

```text
CursorSessionManager
  └── uses InteractiveRunner (new, default)
  └── uses TrustModeRunner (existing, explicit override)

InteractiveRunner
  ├── depends on PtySpawner (spawns and manages PTY)
  ├── depends on PtyOutputParser (strips ANSI, extracts lines)
  ├── depends on PtyPermissionDetector (finds prompts)
  └── calls onProgress / onPermission callbacks

GatewayAgentHandler
  └── wires onPermission to Telegram (send prompt, wait for reply)
```
