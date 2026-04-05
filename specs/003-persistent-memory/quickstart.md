# Quickstart: Persistent Conversation Storage

## Prerequisites

- CloseClaw onboarded with at least one bot (feature 001)
- AI agent configured (feature 002)
- Gateway has been started at least once

## Step 1: Verify Persistence Works Across Restarts

Start the gateway:

```bash
pnpm tsx packages/cli/src/index.ts gateway start
```

Send a few messages to the bot from Telegram/Discord. Note something specific (e.g., "Tell me a joke about TypeScript").

Stop the gateway (Ctrl+C). Restart it:

```bash
pnpm tsx packages/cli/src/index.ts gateway start
```

Send a follow-up: "What joke did you tell me earlier?"

**Expected**: The bot recalls the earlier conversation. Check `~/.closeclaw/conversations/` to see the JSON file.

## Step 2: Verify Compression

Send more than 50 messages to a single bot conversation (or lower the threshold temporarily in config).

After the 51st message, check the conversation file:

```bash
cat ~/.closeclaw/conversations/telegram-<your-id>.json | python3 -m json.tool | head -20
```

**Expected**: The file contains a `compressedSummary` object with a text summary and the recent 20 messages as verbatim entries.

Ask the bot about something from the early messages (before compression).

**Expected**: The bot can still reference facts from the summary.

## Step 3: Verify Preference Memory

Tell the bot: "My name is Ajay and my timezone is IST"

Check the preference file:

```bash
cat ~/.closeclaw/preferences/telegram-<your-id>.json | python3 -m json.tool
```

**Expected**: The file contains entries for "name" and "timezone".

Restart the gateway and ask: "What is my timezone?"

**Expected**: The bot responds "IST" without being reminded.

## Step 4: Verify /clear Preserves Preferences

Send "/clear" to the bot. Then ask: "What is my name?"

**Expected**: The bot still knows your name (from preferences) even though conversation history was cleared.

Check the files:

```bash
ls ~/.closeclaw/conversations/telegram-<your-id>.json  # Should be empty/reset
ls ~/.closeclaw/preferences/telegram-<your-id>.json    # Should still have preferences
```

## Step 5: Verify Forget Preference

Tell the bot: "Forget my timezone"

Check the preference file again.

**Expected**: The "timezone" entry is removed but "name" is still present.

## Step 6: Run Full Verification Suite

```bash
pnpm test && pnpm test:coverage && pnpm lint && pnpm format:check && pnpm build
```

**Expected**: All tests pass, coverage ≥90%, no lint/format issues, build succeeds.
