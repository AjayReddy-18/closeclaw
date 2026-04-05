# Bot Onboarding

The `closeclaw onboard` command sets up your first bot integration,
connecting CloseClaw to a messaging platform.

## Supported Platforms

### Telegram

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Choose a display name for your bot
4. Choose a username ending in `bot`
5. Copy the bot token BotFather sends you
6. Paste the token when the onboard wizard prompts for it

### Discord

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Navigate to the Bot section and create a bot
4. Enable the "Message Content" privileged intent
5. Copy the bot token
6. Paste the token when the onboard wizard prompts for it

## DM Access Policies

DM policies control who can interact with your bot.

### Pairing (Default)

When an unapproved user messages the bot, they receive a pairing
code with instructions. You approve pairing codes via the CLI:

```bash
closeclaw pairing list
closeclaw pairing approve <code>
```

Once approved, the sender can interact freely.

### Allowlist

Only pre-configured sender IDs can message the bot. Useful for
restricting access to a known set of users.

### Open

Anyone can message the bot. A security warning is shown during
configuration since this allows unrestricted access.

## Configuration File

All settings are stored in `~/.closeclaw/config.json`:

```json
{
  "integrations": [
    {
      "platform": "telegram",
      "token": "123456:ABC-DEF...",
      "enabled": true
    }
  ],
  "gateway": {
    "port": 3377,
    "bindAddress": "127.0.0.1",
    "authToken": "auto-generated-token"
  },
  "dmPolicy": {
    "type": "pairing"
  }
}
```

You can edit this file directly for advanced configuration.

## Re-running Onboard

Running `closeclaw onboard` again when integrations exist offers:

- **Reset all** — removes all integrations and starts fresh
- **Reset one** — removes a specific platform and reconfigures it
- **Add new** — adds a different platform alongside the existing one
