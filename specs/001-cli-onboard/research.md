# Research: CLI Onboard Command

**Date**: 2026-04-05
**Feature**: 001-cli-onboard

## CLI Framework

**Decision**: Commander.js for command routing + @inquirer/prompts for interactive input

**Rationale**: Commander.js is the de-facto standard for Node.js CLI tools with TypeScript support, subcommand routing, and option parsing. @inquirer/prompts (v8.x) is the modern rewrite of Inquirer — TypeScript-first, ~12kb bundle size, individual prompt imports (select, input, confirm, password). Together they cover the exact needs: `closeclaw onboard` (command routing) with interactive platform selection, token input, and DM policy prompts.

**Alternatives considered**:

- @clack/prompts: Smaller API, beautiful spinners, but lacks extensibility for complex multi-step flows and doesn't support multi-line prompts. Better suited for simpler wizards.
- oclif: Full CLI framework with plugin system. Overkill for this project's scope; adds unnecessary abstraction layers.
- citty/unbuild: Lighter weight but less ecosystem support and documentation.

## Telegram Bot Integration

**Decision**: grammY (Telegram Bot API framework)

**Rationale**: grammY is the TypeScript-first Telegram bot framework recommended in the constitution's technology stack. Key capabilities for this feature:

- `bot.api.getMe()` provides a simple health check that validates the token and returns bot info (username, capabilities). Returns 401 on invalid/revoked tokens.
- Long polling mode is the default and requires no webhook setup — ideal for a localhost gateway.
- Type-safe API with full TypeScript definitions.
- Active maintenance with regular releases.

**Health check pattern**:

```typescript
const me = await bot.api.getMe(); // throws on invalid token
// me.username, me.can_join_groups, etc.
```

**Error codes**: 401 = invalid/revoked token, 429 = rate limited.

**Alternatives considered**:

- telegraf: Older, less TypeScript-native. grammY is its spiritual successor with better types.
- node-telegram-bot-api: Callback-based, minimal TypeScript support, no middleware ecosystem.

## Discord Bot Integration

**Decision**: Discord.js (official Discord library)

**Rationale**: Discord.js is the most mature and widely-used Discord library for Node.js, recommended in the constitution's technology stack. Key capabilities:

- `client.login(token)` validates the token against the Discord API. Invalid tokens throw `Error [TOKEN_INVALID]`.
- The `ready` event fires after full gateway initialization (guilds, channels populated). This is the true "connected" signal.
- TypeScript-aware: `Client<true>` type in ready handler makes `user` non-nullable.
- Requires `GatewayIntentBits.MessageContent` and `GatewayIntentBits.GuildMembers` for pairing flows.

**Health check pattern**:

```typescript
client.once(Events.ClientReady, (readyClient) => {
  // readyClient.user.tag confirms connection
});
client.login(token); // throws on invalid token
```

**Important**: `client.login()` resolves before the `ready` event fires. Always wait for `ready` to confirm full connectivity.

**Alternatives considered**:

- Eris: Lighter weight but smaller community and fewer TypeScript types.
- discord-api-types + REST only: No gateway connection, can't receive messages.

## Interactive Prompt Library

**Decision**: @inquirer/prompts (v8.x)

**Rationale**: Modern rewrite of Inquirer.js, TypeScript-first, individual prompt imports reduce bundle size. Provides all needed prompt types: `select` (platform choice, DM policy), `input` (token entry), `confirm` (reset confirmation, open policy warning), `password` (token masking).

**Key pattern for this feature**:

- `select()` for platform selection and DM policy choice
- `password()` for bot token input (masks characters)
- `confirm()` for reset confirmation and security warnings
- Ctrl+C handling: @inquirer/prompts throws `ExitPromptError` on Ctrl+C, enabling graceful cleanup

**Alternatives considered**:

- @clack/prompts: Beautiful spinners and progress indicators, but limited prompt types and no password masking. Considered as a secondary option for displaying setup instructions (spinners during health check).

## Configuration Storage

**Decision**: Plain JSON file at `~/.closeclaw/closeclaw.json`

**Rationale**: The spec explicitly requires human-readable, human-editable JSON. Node.js `fs.readFileSync`/`fs.writeFileSync` with `JSON.parse`/`JSON.stringify(data, null, 2)` provides atomic read/write. No additional dependencies needed.

**Atomic write pattern**: Write to a temporary file first (`closeclaw.json.tmp`), then rename. This prevents partial writes on Ctrl+C or crashes, satisfying FR-011 and SC-004.

**Alternatives considered**:

- conf (npm): Auto-handles config directory creation and schema validation, but adds dependency and abstracts away the JSON file location.
- cosmiconfig: Search-based config loading. Overkill for a fixed-path config file.
- YAML/TOML: Rejected per spec — JSON chosen for simplicity and direct editability.

## Gateway Architecture

**Decision**: Single Node.js process running bot adapters with HTTP health endpoint

**Rationale**: The gateway starts after onboarding, connects to Telegram (long polling via grammY) and/or Discord (WebSocket gateway via Discord.js), and exposes a local HTTP endpoint for health checks and pairing management. This keeps the architecture simple for v1 while allowing future expansion.

**Key design decisions**:

- Gateway runs as a foreground process started by `closeclaw onboard` (or later by a dedicated `closeclaw gateway` command)
- Pairing state stored in a JSON file at `~/.closeclaw/pairing.json` (separate from main config to avoid write conflicts)
- Pairing codes: 6-character alphanumeric, generated with `crypto.randomBytes`, 1-hour TTL
- Health check: HTTP GET on localhost port, responds with bot connection status

**Alternatives considered**:

- Separate daemon process: More complex (LaunchAgent, systemd), deferred to future feature
- WebSocket for CLI-to-gateway communication: Overkill for v1 pairing; HTTP REST is simpler
- In-memory pairing state only: Would lose pairing requests on gateway restart

## Monorepo Structure

**Decision**: pnpm workspaces with 4 packages (shared-types, bot-adapters, gateway, cli)

**Rationale**: Aligns with the Modular Architecture principle. Each package has clear boundaries:

- `shared-types`: TypeScript interfaces and type definitions (zero runtime dependencies)
- `bot-adapters`: Platform-specific bot connections behind a common adapter interface
- `gateway`: Local server orchestrating bot adapters, health checks, and pairing
- `cli`: Commander.js commands and @inquirer/prompts interactive flows

Uses `workspace:*` protocol for local dependencies. No build orchestrator (Turborepo) needed at this scale (4 packages, ~20 files).

**Alternatives considered**:

- Single package: Violates Modular Architecture; would make bot adapters tightly coupled to CLI
- Turborepo: Unnecessary overhead for 4 packages; adds complexity without proportional benefit at this scale
- Nx: Enterprise-grade, overkill for this project size
