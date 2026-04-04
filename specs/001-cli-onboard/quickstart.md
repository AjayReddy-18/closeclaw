# Quickstart: CLI Onboard Command

**Date**: 2026-04-05
**Feature**: 001-cli-onboard

## Prerequisites

- Node.js 22 LTS or later
- pnpm 9.x or later
- A Telegram or Discord account

## Install

```bash
git clone <repo-url> closeclaw
cd closeclaw
pnpm install
pnpm build
```

## First-Time Setup

Run the onboarding wizard:

```bash
closeclaw onboard
```

The wizard walks you through:

1. **Platform selection** — choose Telegram or Discord
2. **Bot creation instructions** — step-by-step guide for BotFather (Telegram) or Discord Developer Portal
3. **Token entry** — paste your bot token (masked input)
4. **DM policy selection** — choose pairing (default), allowlist, or open
5. **Gateway auto-configuration** — localhost, auto-generated auth token, default port
6. **Health check** — verifies your bot token and confirms the bot connects to the platform

After completion, your configuration is saved to `~/.closeclaw/closeclaw.json`.

## Approve Your First Message

With the default pairing policy, send a DM to your bot from Telegram or Discord. The bot replies with a pairing code.

```bash
closeclaw pairing list
closeclaw pairing approve <code>
```

You're now paired. Subsequent messages from your account are accepted.

## Add a Second Platform

Run onboarding again:

```bash
closeclaw onboard
```

Choose "Add new integration" and select the other platform. Your existing bot configuration is preserved.

## Reset

To start fresh:

```bash
closeclaw onboard
```

Choose "Reset configuration" and select all or a specific platform.

## Configuration File

The configuration is stored at `~/.closeclaw/closeclaw.json` and can be edited directly:

```bash
cat ~/.closeclaw/closeclaw.json
```

## Verify

Check health:

```bash
curl http://127.0.0.1:18790/health
```

Expected response:
```json
{
  "status": "healthy",
  "channels": {
    "telegram": { "connected": true, "botUsername": "@your_bot" }
  }
}
```

## Validation Script

After building, run the full test suite to verify:

```bash
pnpm test
```

Specific test suites:

```bash
pnpm --filter @closeclaw/cli test        # CLI command tests
pnpm --filter @closeclaw/gateway test     # Gateway + pairing tests
pnpm --filter @closeclaw/bot-adapters test # Bot adapter tests
```
