# Feature Specification: CLI Onboard Command

**Feature Branch**: `001-cli-onboard`
**Created**: 2026-04-05
**Status**: Draft
**Input**: User description: "Develop a CLI tool — `closeclaw onboard` — that guides users through bot integration setup for Telegram and Discord, detects existing configurations, supports reset and add-new flows, persists config to a JSON file in `~/.closeclaw`, and displays step-by-step bot creation instructions. No AI integration yet — focus on bot integration and message passing between machines."

## Clarifications

### Session 2026-04-05

- Q: What DM access policy model should onboarding configure? → A: Pairing as default; user can switch to allowlist or open during onboarding
- Q: Should onboarding include gateway setup or only produce a config file? → A: Include basic gateway setup; bot starts listening after onboard completes
- Q: How much gateway configuration should onboarding handle? → A: Auto-configure with sensible defaults (localhost, auto-generated auth token, default port); no extra prompts
- Q: Should onboarding verify the setup works end-to-end? → A: Run a health check after gateway start (verify token validity + bot connects to platform API) and display the result
- Q: How should users approve incoming pairing requests? → A: CLI commands only: `closeclaw pairing approve <code>` and `closeclaw pairing list`

## User Scenarios & Testing _(mandatory)_

### User Story 1 - First-Time Bot Onboarding (Priority: P1)

A new user runs `closeclaw onboard` for the first time with no prior configuration. The system detects no existing integrations, prompts the user to select a bot platform (Telegram or Discord), walks them through the platform-specific setup steps (creating a bot, obtaining a token), collects their bot token, validates it, configures a DM access policy (defaulting to pairing), auto-configures a local gateway with sensible defaults, saves the configuration to `~/.closeclaw/closeclaw.json`, starts the gateway, runs a health check to verify the bot connects to the platform API, and displays a success summary with pairing instructions.

**Why this priority**: This is the core value proposition — without first-time onboarding, no other flows are possible. It establishes the configuration directory, file structure, the foundational bot integration, access control policy, and a running gateway that all subsequent features depend on.

**Independent Test**: Can be fully tested by running `closeclaw onboard` on a clean machine (no `~/.closeclaw` directory) and verifying that after completing the flow, a valid configuration file exists with bot credentials, DM policy, and gateway settings, and the health check reports success.

**Acceptance Scenarios**:

1. **Given** no `~/.closeclaw` directory exists, **When** the user runs `closeclaw onboard`, **Then** the system creates `~/.closeclaw/` and presents a platform selection prompt (Telegram or Discord)
2. **Given** the user selects Telegram, **When** they are prompted, **Then** the system displays step-by-step instructions for creating a bot via BotFather and asks for the bot token
3. **Given** the user selects Discord, **When** they are prompted, **Then** the system displays step-by-step instructions for creating a Discord application, enabling intents, generating an invite URL, and asks for the bot token
4. **Given** the user provides a valid bot token, **When** the token is submitted, **Then** the system validates the token format and proceeds to DM policy selection
5. **Given** the user provides an invalid or empty bot token, **When** the token is submitted, **Then** the system displays a clear error message and re-prompts for the token
6. **Given** the token is validated, **When** the DM policy prompt appears, **Then** the system defaults to "pairing" and offers alternatives (allowlist, open) with a brief explanation of each
7. **Given** the DM policy is selected, **When** the gateway is configured, **Then** the system auto-configures a local gateway (localhost, auto-generated auth token, default port) without additional prompts
8. **Given** the configuration is saved, **When** the gateway starts, **Then** the system runs a health check that verifies the bot token is valid and the bot connects to the platform API, displaying a clear pass/fail result
9. **Given** the health check passes, **When** the success summary is displayed, **Then** the system shows pairing instructions explaining how to approve the first incoming message via `closeclaw pairing approve <code>`
10. **Given** the health check fails, **When** the failure result is displayed, **Then** the system shows actionable guidance (e.g., re-enter token, check network) and offers to retry or exit

---

### User Story 2 - Approve Pairing Request (Priority: P2)

After onboarding completes and the gateway is running with the default pairing DM policy, a user on Telegram or Discord sends a direct message to the bot. The bot responds with a one-time pairing code instead of processing the message. The bot owner uses `closeclaw pairing list` to see pending requests and `closeclaw pairing approve <code>` to approve the sender. Once approved, subsequent messages from that sender are accepted and processed.

**Why this priority**: Without pairing approval, no one can communicate with the bot after onboarding. This is the immediate next step after first-time setup and is required for the bot to be usable.

**Independent Test**: Can be fully tested by completing onboarding (US1), sending a DM to the bot from a Telegram or Discord account, running `closeclaw pairing list` to confirm the request appears, running `closeclaw pairing approve <code>`, and verifying the sender can now communicate with the bot.

**Acceptance Scenarios**:

1. **Given** the gateway is running with DM policy set to "pairing," **When** an unapproved sender sends a DM to the bot, **Then** the bot responds with a one-time pairing code and does not process the message
2. **Given** a pairing request exists, **When** the owner runs `closeclaw pairing list`, **Then** the system displays all pending requests with sender platform, sender ID, pairing code, and expiration time
3. **Given** a pending pairing request, **When** the owner runs `closeclaw pairing approve <code>`, **Then** the sender is approved and subsequent messages from that sender are accepted
4. **Given** a pairing code has expired (default: 1 hour), **When** the owner tries to approve it, **Then** the system rejects the approval and instructs the sender to re-initiate
5. **Given** no pending pairing requests exist, **When** the owner runs `closeclaw pairing list`, **Then** the system displays a message indicating no pending requests

---

### User Story 3 - Add a New Bot to Existing Configuration (Priority: P3)

A user who already has one bot configured (e.g., Telegram) runs `closeclaw onboard` and wants to add a second bot on a different platform (e.g., Discord). The system detects the existing configuration, offers the choice to add a new integration, and walks the user through setting up the additional platform without affecting existing configurations.

**Why this priority**: After first-time setup and pairing, the next natural step is adding additional bot platforms. This enables multi-platform message passing and expands the utility of CloseClaw.

**Independent Test**: Can be fully tested by pre-populating `~/.closeclaw/closeclaw.json` with a Telegram configuration, running `closeclaw onboard`, choosing "Add new integration," selecting Discord, and verifying both configurations exist in the file afterward.

**Acceptance Scenarios**:

1. **Given** a valid configuration file exists with one bot integration, **When** the user runs `closeclaw onboard`, **Then** the system detects the existing configuration and presents options: "Add new integration" or "Reset configuration"
2. **Given** the user chooses "Add new integration," **When** prompted for platform, **Then** only platforms not yet configured are offered as choices
3. **Given** the user completes the new bot setup, **When** the configuration is saved, **Then** the existing bot configuration remains untouched and the new bot configuration is added alongside it
4. **Given** both Telegram and Discord are already configured, **When** the user tries to add a new integration, **Then** the system informs the user that all supported platforms are already configured and suggests using reset to reconfigure

---

### User Story 4 - Reset Existing Configuration (Priority: P4)

A user who has existing bot configurations wants to start fresh. They run `closeclaw onboard`, choose to reset, and the system clears the existing configuration and re-runs the first-time onboarding flow. The user can also choose to reset only a specific bot integration rather than everything.

**Why this priority**: Users need an escape hatch to fix broken configurations, rotate compromised tokens, or switch platforms. This prevents users from having to manually edit or delete config files.

**Independent Test**: Can be fully tested by pre-populating `~/.closeclaw/closeclaw.json` with configurations for both platforms, running `closeclaw onboard`, choosing "Reset," and verifying the chosen scope of reset is applied correctly.

**Acceptance Scenarios**:

1. **Given** a configuration file exists with integrations, **When** the user chooses "Reset configuration," **Then** the system asks whether to reset all integrations or a specific one
2. **Given** the user chooses to reset all, **When** confirmed, **Then** all bot configurations are removed and the first-time onboarding flow begins
3. **Given** the user chooses to reset a specific platform (e.g., Telegram), **When** confirmed, **Then** only that platform's configuration is removed and the user is guided through re-onboarding that platform while the other platform remains untouched
4. **Given** the user is about to reset, **When** the confirmation prompt appears, **Then** the system warns about the consequences and requires explicit confirmation before proceeding

---

### User Story 5 - View Onboarding Instructions Without Configuring (Priority: P5)

A user runs `closeclaw onboard` and during the platform selection step wants to see the setup instructions for a platform before committing. The onboarding flow displays the step-by-step guide and then asks whether the user is ready to proceed with token entry or wants to come back later.

**Why this priority**: Users may need to leave the terminal to create bots on external platforms (BotFather, Discord Developer Portal). Showing instructions first and allowing deferral improves the user experience without blocking progress.

**Independent Test**: Can be fully tested by running `closeclaw onboard`, selecting a platform, viewing the instructions, and choosing to exit — then verifying no partial configuration was saved.

**Acceptance Scenarios**:

1. **Given** the user selects a platform, **When** the setup instructions are displayed, **Then** the system asks "Are you ready to enter your bot token, or would you like to come back later?"
2. **Given** the user chooses to come back later, **When** exiting, **Then** no configuration changes are saved and the next run starts from the same point
3. **Given** the user chooses to proceed, **When** the token prompt appears, **Then** the flow continues normally into token collection and validation

---

### Edge Cases

- What happens when the `~/.closeclaw` directory exists but `closeclaw.json` is missing or empty? The system treats this as a first-time setup.
- What happens when `closeclaw.json` contains malformed data? The system displays an error explaining the corruption and offers to reset the configuration or exit.
- What happens when the user presses Ctrl+C during onboarding? The system exits gracefully without writing partial configuration.
- What happens when the file system denies write access to `~/.closeclaw`? The system displays a clear permission error with guidance on how to fix it.
- What happens when the user provides a bot token that matches the format but is revoked or expired? Token format validation passes, but the health check after gateway start detects the failure and offers to re-enter the token or exit.
- What happens when a pairing code expires before the owner approves it? The code is rejected and the sender must re-initiate by sending another message; a new code is generated.
- What happens when the health check fails (invalid token, network issue)? The system displays the error, does not finalize gateway config, and offers to re-enter the token or exit.
- What happens when the default gateway port is already in use? The system detects the conflict and tries the next available port, or prompts the user to free the port.
- What happens when the user selects "open" DM policy? The system displays a security warning explaining that anyone can message the bot and requires explicit confirmation before proceeding.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The `closeclaw onboard` command MUST be the entry point for all bot integration setup
- **FR-002**: The system MUST create the `~/.closeclaw/` directory if it does not exist
- **FR-003**: The system MUST persist all configuration to `~/.closeclaw/closeclaw.json` in a human-readable and human-editable JSON format
- **FR-004**: The system MUST detect existing configurations on startup and branch into the appropriate flow (first-time, add-new, or reset)
- **FR-005**: The system MUST support Telegram as a bot platform, including displaying BotFather setup instructions and collecting the bot token
- **FR-006**: The system MUST support Discord as a bot platform, including displaying Developer Portal setup instructions (app creation, intent enabling, invite URL generation) and collecting the bot token
- **FR-007**: The system MUST validate bot token format before saving (Telegram tokens match `digits:alphanumeric` pattern; Discord tokens are non-empty base64-like strings)
- **FR-008**: The system MUST allow adding a new bot integration to an existing configuration without overwriting other integrations
- **FR-009**: The system MUST allow resetting all integrations or a specific platform's integration with explicit user confirmation
- **FR-010**: The system MUST display step-by-step bot creation instructions for each platform before asking for the token
- **FR-011**: The system MUST exit gracefully on interruption (Ctrl+C) without writing partial configuration
- **FR-012**: The system MUST handle malformed or corrupted configuration files by offering reset or exit
- **FR-013**: The system MUST display a summary of the completed configuration at the end of a successful onboarding
- **FR-014**: The system MUST never store bot tokens in plaintext outside of the designated configuration file
- **FR-015**: Re-running `closeclaw onboard` MUST NOT wipe existing configuration unless the user explicitly chooses reset
- **FR-016**: Onboarding MUST prompt for DM access policy with "pairing" as the default and offer alternatives (allowlist, open) with a brief explanation of each
- **FR-017**: Onboarding MUST auto-configure a local gateway with sensible defaults (localhost bind, auto-generated auth token, default port) without additional prompts
- **FR-018**: Onboarding MUST start the gateway and run a health check that verifies the bot token is valid and the bot connects to the platform API
- **FR-019**: The system MUST support `closeclaw pairing list` to display all pending pairing requests with sender platform, sender ID, pairing code, and expiration time
- **FR-020**: The system MUST support `closeclaw pairing approve <code>` to approve a specific pairing request by its code
- **FR-021**: When DM policy is "pairing," the bot MUST respond to unapproved senders with a one-time pairing code and hold their messages until approved
- **FR-022**: When DM policy is "allowlist," only sender IDs explicitly listed in the configured allow list MUST be permitted to communicate with the bot
- **FR-023**: When DM policy is "open," all senders MUST be permitted to communicate (requires explicit opt-in during onboarding with a warning about the security implications)
- **FR-024**: Pairing codes MUST expire after a configurable duration (default: 1 hour); expired codes MUST be rejected with guidance for the sender to re-initiate
- **FR-025**: The health check result MUST be displayed to the user with clear pass/fail status and actionable guidance on failure
- **FR-026**: The system MUST provide a `closeclaw gateway start` command that loads configuration, connects all enabled bot adapters, starts the local HTTP gateway server, and runs as a foreground process
- **FR-027**: When the gateway is running with "pairing" DM policy, the bot MUST automatically reply to unapproved senders with a pairing code and human-readable approval instructions
- **FR-028**: Bot adapters MUST support sending reply messages to senders (in addition to receiving messages)
- **FR-029**: The `closeclaw gateway start` command MUST handle graceful shutdown on SIGINT/SIGTERM (disconnect adapters, stop server, exit 0)
- **FR-030**: If no configuration file exists when `closeclaw gateway start` is run, the system MUST display an error directing the user to run `closeclaw onboard` first
- **FR-031**: After successful onboarding, the system SHOULD offer to start the gateway immediately

### Key Entities

- **Bot Integration**: Represents a configured bot on a specific platform. Attributes: platform name, bot token, enabled status, DM policy (pairing | allowlist | open), allowed senders (list of platform-specific user IDs, used when policy is allowlist), creation timestamp
- **Gateway Configuration**: The local gateway settings auto-configured during onboarding. Attributes: bind address, port, auth token, auto-start flag
- **Configuration**: The root configuration object persisted to disk. Contains a collection of bot integrations, gateway configuration, and metadata about the configuration itself (version, last modified timestamp)
- **Onboarding Session**: The transient state of an in-progress onboarding flow. Tracks which step the user is on and whether changes should be committed to disk
- **Pairing Request**: A pending authorization request from an unapproved sender. Attributes: sender platform, sender ID, pairing code, expiration timestamp, status (pending | approved | expired)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A first-time user completes Telegram bot onboarding in under 5 minutes (excluding time spent in BotFather)
- **SC-002**: A first-time user completes Discord bot onboarding in under 7 minutes (excluding time spent in the Discord Developer Portal)
- **SC-003**: 100% of successful onboarding runs produce a valid, parseable configuration file
- **SC-004**: Interrupted onboarding (Ctrl+C at any step) results in zero partial writes to the configuration file
- **SC-005**: Users with existing configurations can add a second platform without re-entering credentials for the first platform
- **SC-006**: The configuration file is directly editable by users — opening it in a text editor reveals a clear, well-structured JSON document
- **SC-007**: The health check completes within 10 seconds of gateway start and displays a clear pass/fail result
- **SC-008**: A user can approve a pairing request and the approved sender receives a response within 30 seconds of running the approve command

---

### User Story 6 - Gateway Start and Bot Auto-Reply (Priority: P1-patch)

After onboarding completes, the user needs a way to start the gateway as a long-running process so that bot adapters actively listen for incoming DMs. When an unapproved sender messages the bot under the "pairing" DM policy, the bot must reply with a pairing code and instructions for the owner to approve them.

**Why this priority**: Without a running gateway, the bot cannot receive or respond to any messages after onboarding. This is a critical gap that makes pairing (US2) non-functional in practice. The gateway must run as a foreground process that keeps bot adapters connected and the HTTP pairing API available.

**Independent Test**: After onboarding (US1), run `closeclaw gateway start`. Send a DM to the bot from Telegram or Discord. Verify the bot auto-replies with a pairing code. Run `closeclaw pairing approve <code>` from another terminal. Verify the sender can now communicate freely.

**Acceptance Scenarios**:

1. **Given** a valid `~/.closeclaw/closeclaw.json` exists with at least one bot integration, **When** the user runs `closeclaw gateway start`, **Then** the system loads the config, connects all enabled bot adapters, starts the HTTP server, and keeps running in the foreground
2. **Given** the gateway is running with DM policy "pairing," **When** an unapproved sender sends a DM, **Then** the bot replies to that sender with a message containing a pairing code and instructions: "Pairing code: `XXXXXX`. Ask the owner to run: closeclaw pairing approve XXXXXX"
3. **Given** the gateway is running, **When** an approved sender sends a DM, **Then** the message is accepted without a pairing challenge
4. **Given** no configuration file exists, **When** the user runs `closeclaw gateway start`, **Then** the system displays an error instructing them to run `closeclaw onboard` first
5. **Given** the gateway is running, **When** the user presses Ctrl+C, **Then** the system gracefully disconnects all bot adapters, stops the HTTP server, and exits cleanly
6. **Given** onboarding completes successfully, **When** the success summary is displayed, **Then** the system prompts the user: "Start the gateway now?" and if they agree, transitions into `closeclaw gateway start` behavior

---

## Assumptions

- Users have a terminal environment capable of interactive prompts (stdin is a TTY)
- Users have an internet connection to access BotFather (Telegram) or the Discord Developer Portal; the CLI requires internet access during the health check step (to verify the bot token against the platform API)
- The home directory (`~`) is writable by the current user
- AI model integration is out of scope for this feature — this feature handles bot credential onboarding, DM access policy, gateway auto-configuration, health check, and pairing approval
- The gateway is auto-configured with localhost defaults; remote gateway connections and advanced gateway configuration (custom bind addresses, Tailscale exposure) are out of scope for v1
- Pairing approval is CLI-only in v1; web UI or mobile approval flows are out of scope
- The configuration file format will be JSON (not YAML, TOML, or other formats) for simplicity and direct editability
- Only Telegram and Discord are supported platforms in v1; additional platforms (Slack, WhatsApp, etc.) will be added in future features
- Non-interactive mode (`--non-interactive`) is out of scope for v1; the onboarding flow is interactive only
