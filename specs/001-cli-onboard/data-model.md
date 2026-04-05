# Data Model: CLI Onboard Command

**Date**: 2026-04-05
**Feature**: 001-cli-onboard

## Entities

### BotPlatform (enum)

Supported bot platforms.

| Value    | Description                          |
| -------- | ------------------------------------ |
| telegram | Telegram Bot API via BotFather       |
| discord  | Discord Bot API via Developer Portal |

### DmPolicy (enum)

Controls who can send direct messages to the bot.

| Value     | Description                                                            |
| --------- | ---------------------------------------------------------------------- |
| pairing   | Unapproved senders receive a one-time code; owner must approve via CLI |
| allowlist | Only pre-approved sender IDs can communicate                           |
| open      | All senders permitted (requires explicit opt-in)                       |

### BotIntegration

A configured bot on a specific platform.

| Field          | Type              | Required | Description                                                    |
| -------------- | ----------------- | -------- | -------------------------------------------------------------- |
| platform       | BotPlatform       | yes      | Which platform this bot connects to                            |
| botToken       | string            | yes      | Platform-specific bot authentication token                     |
| enabled        | boolean           | yes      | Whether this integration is active                             |
| dmPolicy       | DmPolicy          | yes      | Access control policy for direct messages                      |
| allowedSenders | string[]          | no       | Platform-specific user IDs (used when dmPolicy is "allowlist") |
| createdAt      | string (ISO 8601) | yes      | When this integration was first configured                     |

**Validation rules**:

- Telegram botToken: matches pattern `^\d+:[A-Za-z0-9_-]+$`
- Discord botToken: non-empty string, base64-like characters
- allowedSenders required and non-empty when dmPolicy is "allowlist"
- allowedSenders ignored when dmPolicy is "pairing" or "open"

### GatewayConfig

Local gateway server settings.

| Field       | Type   | Required | Default          | Description                                      |
| ----------- | ------ | -------- | ---------------- | ------------------------------------------------ |
| bindAddress | string | yes      | "127.0.0.1"      | Network interface to bind to                     |
| port        | number | yes      | 18790            | HTTP port for health checks and pairing API      |
| authToken   | string | yes      | (auto-generated) | Token for authenticating CLI-to-gateway requests |

**Validation rules**:

- port: integer between 1024 and 65535
- authToken: minimum 32 characters, generated via `crypto.randomBytes(32).toString('hex')`
- bindAddress: valid IPv4 address

### Configuration

Root configuration object persisted to `~/.closeclaw/closeclaw.json`.

| Field        | Type                                | Required | Description                             |
| ------------ | ----------------------------------- | -------- | --------------------------------------- |
| version      | string                              | yes      | Configuration schema version (semver)   |
| lastModified | string (ISO 8601)                   | yes      | When the configuration was last written |
| channels     | Record<BotPlatform, BotIntegration> | yes      | Map of platform to bot integration      |
| gateway      | GatewayConfig                       | yes      | Local gateway settings                  |

**Validation rules**:

- version: valid semver string (initial: "1.0.0")
- channels: at least one entry after successful onboarding
- Each key in channels must be a valid BotPlatform value

**Example**:

```json
{
  "version": "1.0.0",
  "lastModified": "2026-04-05T14:30:00Z",
  "channels": {
    "telegram": {
      "platform": "telegram",
      "botToken": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
      "enabled": true,
      "dmPolicy": "pairing",
      "createdAt": "2026-04-05T14:30:00Z"
    }
  },
  "gateway": {
    "bindAddress": "127.0.0.1",
    "port": 18790,
    "authToken": "a1b2c3d4e5f6..."
  }
}
```

### PairingRequest

A pending authorization request from an unapproved sender. Stored in `~/.closeclaw/pairing.json`.

| Field             | Type              | Required | Description                                         |
| ----------------- | ----------------- | -------- | --------------------------------------------------- |
| code              | string            | yes      | 6-character alphanumeric pairing code               |
| senderPlatform    | BotPlatform       | yes      | Which platform the sender messaged from             |
| senderId          | string            | yes      | Platform-specific sender identifier                 |
| senderDisplayName | string            | no       | Human-readable name if available from the platform  |
| createdAt         | string (ISO 8601) | yes      | When the pairing request was created                |
| expiresAt         | string (ISO 8601) | yes      | When the code expires (default: createdAt + 1 hour) |
| status            | PairingStatus     | yes      | Current state of the request                        |

### PairingStatus (enum)

| Value    | Description                            |
| -------- | -------------------------------------- |
| pending  | Awaiting owner approval                |
| approved | Owner approved; sender can communicate |
| expired  | Code TTL elapsed without approval      |

### PairingStore

Container for pairing data persisted to `~/.closeclaw/pairing.json`.

| Field           | Type             | Required | Description                                       |
| --------------- | ---------------- | -------- | ------------------------------------------------- |
| requests        | PairingRequest[] | yes      | All pairing requests (pending, approved, expired) |
| approvedSenders | ApprovedSender[] | yes      | Permanently approved senders                      |

### ApprovedSender

A sender who has been approved via pairing.

| Field       | Type              | Required | Description                         |
| ----------- | ----------------- | -------- | ----------------------------------- |
| platform    | BotPlatform       | yes      | Which platform the sender uses      |
| senderId    | string            | yes      | Platform-specific sender identifier |
| displayName | string            | no       | Human-readable name if available    |
| approvedAt  | string (ISO 8601) | yes      | When the sender was approved        |

## State Transitions

### Pairing Request Lifecycle

```
[new DM from unapproved sender]
        │
        ▼
    ┌────────┐
    │pending │
    └────┬───┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│approved│ │expired │
└────────┘ └────────┘
```

- **pending → approved**: Owner runs `closeclaw pairing approve <code>`
- **pending → expired**: Code TTL elapses (1 hour default)
- approved and expired are terminal states

### Onboarding Session Flow

```
[closeclaw onboard]
        │
        ▼
  detect config ──→ [exists] ──→ prompt: add-new or reset
        │                              │           │
        │                              ▼           ▼
        ▼                         add-new flow  reset flow
  [no config]                          │           │
        │                              ▼           ▼
        ▼                    ┌─────────────────────┐
  first-time flow ──────────→│ platform selection   │
                             │ show instructions    │
                             │ collect token        │
                             │ validate token       │
                             │ select DM policy     │
                             │ auto-config gateway  │
                             │ save config          │
                             │ start gateway        │
                             │ run health check     │
                             │ show summary         │
                             └─────────────────────┘
```

## File Layout

| File                          | Purpose                                         | Written by                                 |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------ |
| `~/.closeclaw/closeclaw.json` | Main configuration (bot integrations + gateway) | onboard command                            |
| `~/.closeclaw/pairing.json`   | Pairing requests and approved senders           | gateway (on DM receipt) + pairing commands |
