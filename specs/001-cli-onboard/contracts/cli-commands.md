# CLI Command Contracts: CLI Onboard Command

**Date**: 2026-04-05
**Feature**: 001-cli-onboard

## Commands

### `closeclaw onboard`

Interactive onboarding wizard for bot integration setup.

**Synopsis**: `closeclaw onboard`

**Arguments**: None

**Options**: None (v1 is interactive-only)

**Behavior**:

1. If no `~/.closeclaw/closeclaw.json` exists → first-time flow
2. If config exists → prompt: "Add new integration" or "Reset configuration"

**Exit codes**:

| Code | Meaning                                                     |
| ---- | ----------------------------------------------------------- |
| 0    | Onboarding completed successfully                           |
| 1    | Onboarding failed (health check failure, write error, etc.) |
| 130  | User interrupted with Ctrl+C (no partial writes)            |

**Stdout**: Interactive prompts, setup instructions, health check results, success summary

**Stderr**: Error messages (invalid token, permission denied, network errors)

---

### `closeclaw pairing list`

Display all pending pairing requests.

**Synopsis**: `closeclaw pairing list`

**Arguments**: None

**Options**: None

**Behavior**:

1. Reads `~/.closeclaw/pairing.json`
2. Filters for requests with status "pending" and not expired
3. Displays table with columns: Platform, Sender ID, Display Name, Code, Expires In

**Exit codes**:

| Code | Meaning                                 |
| ---- | --------------------------------------- |
| 0    | Success (even if no pending requests)   |
| 1    | Error (config missing, file unreadable) |

**Stdout**: Table of pending requests, or "No pending pairing requests" message

**Example output**:

```
Pending Pairing Requests:

  Platform   Sender ID     Name        Code     Expires In
  telegram   123456789     @alice      A7X3K2   47 minutes
  discord    987654321     bob#1234    M9P2L5   12 minutes

To approve: closeclaw pairing approve <code>
```

---

### `closeclaw gateway start`

Start the gateway as a long-running foreground process.

**Synopsis**: `closeclaw gateway start`

**Arguments**: None

**Options**: None

**Behavior**:

1. Reads `~/.closeclaw/closeclaw.json`
2. If config missing → error: "No configuration found. Run `closeclaw onboard` first."
3. Instantiates bot adapters for each enabled channel
4. Connects all adapters (Telegram long polling, Discord WebSocket)
5. Starts HTTP gateway server with pairing endpoints
6. Wires DM policy enforcer: unapproved senders get auto-reply with pairing code
7. Keeps running until SIGINT/SIGTERM

**Exit codes**:

| Code | Meaning                                                |
| ---- | ------------------------------------------------------ |
| 0    | Graceful shutdown (Ctrl+C / SIGTERM)                   |
| 1    | Error (missing config, adapter failure, port conflict) |

**Stdout**: Status messages (connected adapters, listening port, incoming DM events)

**Auto-reply message format** (when DM policy is "pairing" and sender is unapproved):

```
Pairing code: XXXXXX
Ask the owner to run: closeclaw pairing approve XXXXXX
```

---

### `closeclaw pairing approve <code>`

Approve a pending pairing request by its code.

**Synopsis**: `closeclaw pairing approve <code>`

**Arguments**:

| Argument | Required | Description                           |
| -------- | -------- | ------------------------------------- |
| code     | yes      | 6-character alphanumeric pairing code |

**Options**: None

**Behavior**:

1. Reads `~/.closeclaw/pairing.json`
2. Finds request matching the provided code
3. If found and pending: marks as approved, adds sender to approved list
4. If found but expired: rejects with guidance
5. If not found: reports no matching request

**Exit codes**:

| Code | Meaning                                          |
| ---- | ------------------------------------------------ |
| 0    | Sender approved successfully                     |
| 1    | Error (code not found, code expired, file error) |

**Stdout**: Success confirmation with sender details

**Example output (success)**:

```
Approved! @alice (telegram:123456789) can now message your bot.
```

**Example output (expired)**:

```
Error: Pairing code A7X3K2 has expired.
Ask the sender to message the bot again to generate a new code.
```

## Gateway Health Check API

### `GET /health`

Returns the health status of the gateway and connected bot adapters.

**Request**: No body or authentication required (localhost only)

**Response (200 OK)**:

```json
{
  "status": "healthy",
  "uptime": 3600,
  "channels": {
    "telegram": {
      "connected": true,
      "botUsername": "@my_closeclaw_bot"
    },
    "discord": {
      "connected": true,
      "botUsername": "CloseClaw#1234"
    }
  }
}
```

**Response (503 Service Unavailable)**:

```json
{
  "status": "unhealthy",
  "uptime": 5,
  "channels": {
    "telegram": {
      "connected": false,
      "error": "401 Unauthorized: invalid bot token"
    }
  }
}
```

## Gateway Pairing API

### `GET /pairing`

List pending pairing requests (used by `closeclaw pairing list`).

**Request headers**: `Authorization: Bearer <gateway-auth-token>`

**Response (200 OK)**:

```json
{
  "requests": [
    {
      "code": "A7X3K2",
      "senderPlatform": "telegram",
      "senderId": "123456789",
      "senderDisplayName": "@alice",
      "createdAt": "2026-04-05T14:30:00Z",
      "expiresAt": "2026-04-05T15:30:00Z",
      "status": "pending"
    }
  ]
}
```

### `POST /pairing/approve`

Approve a pairing request (used by `closeclaw pairing approve <code>`).

**Request headers**: `Authorization: Bearer <gateway-auth-token>`

**Request body**:

```json
{
  "code": "A7X3K2"
}
```

**Response (200 OK)**:

```json
{
  "approved": true,
  "sender": {
    "platform": "telegram",
    "senderId": "123456789",
    "displayName": "@alice"
  }
}
```

**Response (404 Not Found)**:

```json
{
  "error": "no_matching_request",
  "message": "No pending pairing request found for code A7X3K2"
}
```

**Response (410 Gone)**:

```json
{
  "error": "code_expired",
  "message": "Pairing code A7X3K2 expired at 2026-04-05T15:30:00Z"
}
```
