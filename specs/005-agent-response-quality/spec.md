# Feature Specification: Agent Response Quality

**Feature Branch**: `005-agent-response-quality`  
**Created**: 2026-04-05  
**Status**: Draft  
**Input**: User description: "Enhance the agent response to the user. Responses are sometimes huge and mostly in markdown format that doesn't look great in Telegram. Want response to be more clean, concise, and user friendly. Scheduled task polling sends responses every 5 min even when nothing changed. Enhance the agent system prompt for smarter behavior."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Telegram-Friendly Response Formatting (Priority: P1)

A user sends a question to the CloseClaw bot on Telegram. The AI agent generates a response that may contain markdown formatting (headers, tables, code blocks, bold/italic text). Before the response reaches the user's Telegram chat, the system automatically converts standard markdown into Telegram-compatible formatting so it renders cleanly — bold text appears bold, code appears in monospace, and unsupported elements (like markdown tables) are converted to a readable plain-text alternative.

**Why this priority**: This is the most visible pain point. Every single response the user sees is affected. Poor formatting erodes trust and makes the tool feel unpolished.

**Independent Test**: Can be fully tested by sending prompts that produce markdown-heavy responses (tables, headers, code, lists) and verifying the Telegram output is well-formatted and readable.

**Acceptance Scenarios**:

1. **Given** the AI generates a response with markdown headers (`# Title`), **When** delivered to Telegram, **Then** headers are converted to bold text (no raw `#` symbols visible)
2. **Given** the AI generates a response with markdown tables, **When** delivered to Telegram, **Then** tables are converted to a clean, aligned text representation since Telegram does not support tables
3. **Given** the AI generates a response with code blocks, **When** delivered to Telegram, **Then** code blocks render as Telegram preformatted text
4. **Given** the AI generates a response with bold (`**text**`) and italic (`*text*`), **When** delivered to Telegram, **Then** they render with proper Telegram bold and italic formatting
5. **Given** the AI generates a response with inline links `[text](url)`, **When** delivered to Telegram, **Then** links render as clickable Telegram hyperlinks
6. **Given** the AI generates a response for Discord, **When** delivered to Discord, **Then** standard markdown passes through unchanged since Discord natively supports it
7. **Given** the response exceeds Telegram's 4096-character message limit, **When** delivered, **Then** the system splits it into multiple messages that each render correctly

---

### User Story 2 - Smart Scheduled Task Response Suppression (Priority: P1)

A user asks the agent to "monitor my Jenkins build and tell me when it finishes." The agent schedules a recurring task that polls every few minutes. Currently, every poll triggers a response delivered to the user — even when nothing has changed ("Still running... 45% complete"). The user only wants to hear back when the task is actually done or when something significant changes (like a failure). The system should suppress intermediate responses that don't carry meaningful new information.

**Why this priority**: Equal to P1 because this is actively annoying users. Getting spammed with "still running" messages every 5 minutes defeats the purpose of background monitoring.

**Independent Test**: Can be fully tested by scheduling a monitoring task, having the AI return "still in progress" responses on several polls, and verifying that only the final completion response (or a significant status change) is delivered to the user.

**Acceptance Scenarios**:

1. **Given** a scheduled monitoring task is active, **When** the AI response indicates no meaningful change (e.g., "still running", "in progress", "no update"), **Then** the system suppresses that response and does not send it to the user
2. **Given** a scheduled monitoring task is active, **When** the AI response indicates the task is complete (e.g., "build succeeded", "deployment finished"), **Then** the response is delivered to the user immediately
3. **Given** a scheduled monitoring task is active, **When** the AI response indicates a failure or critical change (e.g., "build failed", "error detected"), **Then** the response is delivered to the user immediately
4. **Given** a scheduled task with suppression active, **When** the user explicitly asks for a status update in the main conversation, **Then** the agent provides the latest known status regardless of suppression rules
5. **Given** a scheduled monitoring task has been suppressed for an extended period (configurable, default 30 minutes of silence), **When** the next poll occurs, **Then** a brief status update is delivered to prevent the user from wondering if monitoring is still active

---

### User Story 3 - Enhanced Agent System Prompt (Priority: P2)

The agent's system prompt is currently a single line: "You are CloseClaw, a helpful AI assistant." This lacks guidance on response style, conciseness, formatting expectations, tool usage strategy, and conversation behavior. The system prompt should be enriched to produce higher-quality, more natural, and more useful responses — drawing inspiration from how OpenClaw structures its system prompt with sections for identity, behavior, tool usage, and response style.

**Why this priority**: A better system prompt improves every interaction across the board. It's the single highest-leverage change for response quality but depends on P1 formatting to fully realize its benefits.

**Independent Test**: Can be fully tested by comparing response quality before and after the prompt enhancement — responses should be more concise, more direct, use formatting intentionally, and demonstrate smarter tool usage.

**Acceptance Scenarios**:

1. **Given** the enhanced system prompt is active, **When** the user asks a simple question, **Then** the agent responds concisely (1-3 sentences) rather than producing a wall of text
2. **Given** the enhanced system prompt is active, **When** the user asks something the agent has tools for (datetime, HTTP, shell), **Then** the agent uses tools proactively rather than speculating
3. **Given** the enhanced system prompt is active, **When** the agent would normally generate a long report, **Then** it uses structured formatting (bullet points, short paragraphs) and keeps the response focused
4. **Given** the enhanced system prompt is active, **When** the user sends a message on Telegram, **Then** the agent tailors response length and formatting to be mobile-friendly
5. **Given** the user has configured a custom system prompt, **When** the gateway starts, **Then** the custom prompt augments (not replaces) the built-in behavioral guidance

---

### User Story 4 - Response Length Control via User Preferences (Priority: P3)

A user finds the agent too verbose or too brief for their taste. The user can tell the agent "be more concise" or "give me detailed answers" and the agent remembers this preference, adjusting future responses accordingly. This leverages the existing preference store.

**Why this priority**: Nice-to-have personalization that builds on the existing preference system and the enhanced system prompt.

**Independent Test**: Can be tested by telling the agent "keep responses short" and verifying subsequent responses are shorter, then saying "give detailed answers" and verifying they expand.

**Acceptance Scenarios**:

1. **Given** the user says "keep your answers short", **When** the agent processes a subsequent question, **Then** it responds more concisely than the default style
2. **Given** the user has a "verbose" preference stored, **When** the agent generates a response, **Then** it provides more comprehensive detail
3. **Given** the user has not set a response-length preference, **When** the agent responds, **Then** it uses the default balanced style from the system prompt

---

### Edge Cases

- What happens when the AI produces malformed markdown (unclosed code blocks, nested formatting)?
- How does the system handle responses that are entirely code blocks (should remain preformatted)?
- What happens when Telegram's API rejects a formatted message (invalid parse_mode syntax)?
- How does suppression work when a task's "completion" signal is ambiguous?
- What happens when the user changes platform mid-conversation (starts on Discord, continues on Telegram)?
- How does the system handle emoji-heavy responses in formatting conversion?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST convert standard markdown in AI responses to Telegram-compatible formatting before delivery on the Telegram platform
- **FR-002**: System MUST handle markdown headers by converting them to bold text for Telegram
- **FR-003**: System MUST handle markdown tables by converting them to a clean aligned plain-text representation for Telegram
- **FR-004**: System MUST handle markdown code blocks by converting them to Telegram preformatted blocks
- **FR-005**: System MUST handle bold, italic, strikethrough, and inline code markdown by converting to Telegram-supported equivalents
- **FR-006**: System MUST handle markdown links by converting to Telegram-supported hyperlink format
- **FR-007**: System MUST split responses exceeding platform character limits into multiple well-formed messages
- **FR-008**: System MUST pass markdown through unchanged for platforms that natively support it (Discord)
- **FR-009**: System MUST suppress scheduled task responses that indicate no meaningful change from the previous state
- **FR-010**: System MUST deliver scheduled task responses immediately when they indicate completion, failure, or significant status changes
- **FR-011**: System MUST deliver a periodic "still monitoring" heartbeat message if no updates have been delivered for a configurable duration (default 30 minutes)
- **FR-012**: System MUST include an enhanced default system prompt that guides the AI on conciseness, formatting, tool usage, and conversation style
- **FR-013**: System MUST allow user-configured system prompts to augment the built-in behavioral guidance
- **FR-014**: System MUST respect user preferences for response verbosity when generating responses
- **FR-015**: System MUST gracefully fall back to plain text if formatted message delivery fails

### Key Entities

- **ResponseFormatter**: Transforms raw AI output into platform-appropriate format before delivery
- **SuppressionFilter**: Evaluates scheduled task responses to decide whether they carry meaningful new information
- **SystemPrompt**: The assembled instruction set guiding AI behavior, composed of built-in guidance plus optional user customization

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All AI responses on Telegram render with proper formatting (no raw markdown symbols visible to the user)
- **SC-002**: Scheduled monitoring tasks deliver no more than 1 intermediate "no change" notification per 30 minutes (vs. every poll interval currently)
- **SC-003**: Average response length for simple questions decreases by at least 40% compared to the current generic system prompt
- **SC-004**: Response formatting conversion introduces no more than 100ms of additional latency per message
- **SC-005**: Users can adjust response verbosity through natural language and the preference persists across sessions
- **SC-006**: Zero bot crashes caused by formatting edge cases (malformed markdown, oversized messages)

## Assumptions

- Telegram MarkdownV2 or HTML parse_mode will be used for rich formatting; HTML is generally more reliable for complex formatting
- The existing preference store is sufficient for storing response-style preferences without schema changes
- The AI model (Claude Sonnet 4.6) already generates well-structured markdown; the challenge is translation to Telegram, not generation quality
- Discord natively supports markdown, so no conversion is needed for Discord messages
- The 4096-character Telegram message limit is the primary splitting boundary
- Scheduled task suppression logic will run in the scheduler layer, between the AI response and the delivery function
- The enhanced system prompt will be maintained as part of the codebase (not user-configurable for the built-in sections)
