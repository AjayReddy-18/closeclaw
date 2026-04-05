# Feature Specification: AI Agent Routing

**Feature Branch**: `002-ai-agent-routing`
**Created**: 2026-04-05
**Status**: Draft
**Input**: User description: "Message routing and AI agent integration — transform CloseClaw from a bot that gates DMs into a bot that processes messages through configurable AI models. Support multiple providers (Ollama, Anthropic Claude, OpenAI, Kimi, Gemini, etc.). The model processes the user's message, decides what to do, routes to other processes, and sends responses back to the user."

## Clarifications

### Session 2026-04-05

- Q: What is the scope of "routing to other processes"? → A: The AI model can call tools/functions that execute predefined actions (shell commands, HTTP calls, file operations) and decide whether to send the result to the user, chain into another tool call, or end the conversation turn.
- Q: Should conversation context be preserved across messages? → A: Yes, each sender has an ongoing conversation with history, up to a configurable context window. History resets when the context limit is reached or the user explicitly clears it.
- Q: How are AI providers configured? → A: Via `closeclaw agent configure` CLI command that prompts for provider, model, and API key. Configuration is stored in `~/.closeclaw/config.json` alongside existing bot settings.
- Q: How should the model name be selected during configuration? → A: After choosing a provider, show a selectable list of popular models for that provider plus a "Custom (enter manually)" option at the end for free-text entry. This prevents typos while supporting unlisted/fine-tuned models.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Configure AI Agent Provider (Priority: P1)

After completing bot onboarding (feature 001), the user runs `closeclaw agent configure` to set up an AI model provider. The system prompts for the provider (OpenAI, Anthropic, Google Gemini, Ollama, Kimi, or a custom OpenAI-compatible endpoint), the specific model name, and the API key (if required). The configuration is validated by making a lightweight test call to the provider, and the result is saved to the existing configuration file. Once configured, the gateway knows where to route approved messages.

**Why this priority**: Without a configured AI provider, no message processing is possible. This is the prerequisite for all other stories in this feature — it connects CloseClaw to the "brain" that processes messages.

**Independent Test**: Run `closeclaw agent configure`, select a provider (e.g., Ollama for local testing without API keys), choose a model, and verify the configuration is saved to `~/.closeclaw/config.json` with the agent section populated. Run the gateway and confirm it logs that an AI agent is active.

**Acceptance Scenarios**:

1. **Given** a completed onboarding with at least one bot configured, **When** the user runs `closeclaw agent configure`, **Then** the system presents a list of supported AI providers to choose from
2. **Given** the user selects a cloud provider (OpenAI, Anthropic, Gemini, Kimi), **When** prompted for API credentials, **Then** the system collects the API key via masked input and presents a selectable list of popular models for the chosen provider with a "Custom (enter manually)" option for free-text entry
3. **Given** the user selects Ollama (local provider), **When** prompted for configuration, **Then** the system asks for the Ollama server URL (defaulting to `http://localhost:11434`) and presents a selectable list of popular Ollama models with a "Custom (enter manually)" option, without requiring an API key
4. **Given** the user selects "Custom (OpenAI-compatible)" provider, **When** prompted, **Then** the system collects a base URL, optional API key, and prompts for a model name via free-text input (no predefined list) — enabling any provider that exposes an OpenAI-compatible chat completions endpoint
5. **Given** the provider details are entered, **When** the system validates the configuration, **Then** it makes a lightweight test request (a simple prompt) to confirm the provider is reachable and the credentials are valid, displaying a clear pass/fail result
6. **Given** validation succeeds, **When** the configuration is saved, **Then** the agent configuration is written to `~/.closeclaw/config.json` under a new `agent` section without overwriting existing bot or gateway settings
7. **Given** validation fails (unreachable server, invalid API key, unknown model), **When** the failure is displayed, **Then** the system offers to re-enter credentials or exit without saving
8. **Given** an agent is already configured, **When** the user runs `closeclaw agent configure` again, **Then** the system shows the current configuration and offers to reconfigure or keep the existing setup

---

### User Story 2 - AI Processes Approved Messages (Priority: P2)

With the AI agent configured and the gateway running, an approved sender sends a direct message to the bot. Instead of just logging the message, the gateway forwards it to the configured AI model. The model generates a response, and the bot sends that response back to the sender in the same DM conversation. Conversation history is maintained per sender so the AI has context from previous exchanges.

**Why this priority**: This is the core value delivery — the bot actually responds intelligently to messages. Without this, the AI configuration from US1 has no effect. This transforms CloseClaw from a message gatekeeper into an interactive AI assistant.

**Independent Test**: Configure an AI provider (US1), start the gateway, send a message from an approved sender (complete pairing first), and verify the bot responds with an AI-generated reply. Send a follow-up message referencing the first, and verify the AI demonstrates awareness of conversation context.

**Acceptance Scenarios**:

1. **Given** the gateway is running with an AI agent configured and a sender is approved, **When** the sender sends a DM, **Then** the system forwards the message text to the configured AI model with the sender's conversation history
2. **Given** the AI model returns a text response, **When** the response is received, **Then** the bot sends the AI's response back to the sender in the same DM channel
3. **Given** the sender sends a follow-up message, **When** it is forwarded to the AI, **Then** the conversation history from previous exchanges is included so the AI can maintain context
4. **Given** the conversation history exceeds the configured context window, **When** a new message arrives, **Then** the oldest messages are trimmed from history to fit within the limit, and the AI still receives the most recent context
5. **Given** the AI model is unreachable or returns an error, **When** a message is processed, **Then** the bot sends a user-friendly error message to the sender (e.g., "I'm having trouble thinking right now. Please try again in a moment.") and logs the error for the operator
6. **Given** no AI agent is configured but the gateway is running, **When** an approved sender sends a DM, **Then** the bot does not attempt AI processing and logs the message as before (backward-compatible with feature 001 behavior)

---

### User Story 3 - System Prompt and Agent Persona (Priority: P3)

The user configures a system prompt that defines the AI agent's persona, behavior rules, and capabilities. This system prompt is sent with every conversation to guide the AI's responses. The user can set and update the system prompt via `closeclaw agent system-prompt` without reconfiguring the entire provider.

**Why this priority**: A bare AI model without a system prompt gives generic responses. The system prompt transforms the agent from a generic chatbot into a purpose-built assistant with specific behavior, personality, and domain knowledge relevant to the user's needs.

**Independent Test**: Set a system prompt (e.g., "You are a helpful DevOps assistant. Only discuss infrastructure topics."), send messages to the bot, and verify responses adhere to the persona. Change the system prompt and verify the new behavior takes effect.

**Acceptance Scenarios**:

1. **Given** an AI agent is configured, **When** the user runs `closeclaw agent system-prompt`, **Then** the system opens an interactive editor or multi-line input to compose the system prompt
2. **Given** the user enters a system prompt, **When** it is saved, **Then** the prompt is stored in the agent configuration and used as the first message in every new conversation with every sender
3. **Given** no system prompt is configured, **When** the AI processes a message, **Then** a sensible default system prompt is used (e.g., "You are CloseClaw, a helpful AI assistant.")
4. **Given** a system prompt exists, **When** the user runs `closeclaw agent system-prompt` again, **Then** the current prompt is displayed and the user can edit or replace it
5. **Given** the system prompt is updated, **When** a sender sends a new message, **Then** the AI uses the updated system prompt for that conversation going forward (existing history is preserved, but the system prompt at the start of the context is the new one)

---

### User Story 4 - Tool Calling and Action Execution (Priority: P4)

The AI agent can call predefined tools to take actions beyond generating text responses. When the AI decides an action is needed (e.g., running a shell command, making an HTTP request, reading a file), it emits a tool call. The system executes the tool, returns the result to the AI, and the AI decides whether to present the result to the user, chain into another tool call, or synthesize a final answer.

**Why this priority**: Tool calling transforms the agent from a conversationalist into an automation engine — the stated goal of CloseClaw ("eliminate manual intervention in repetitive tasks"). However, it requires the simpler message-response loop (US2) to be working first.

**Independent Test**: Configure an agent with tools enabled, send a message that requires a tool (e.g., "What is the current date and time?"), and verify the AI invokes the `datetime` tool, receives the result, and incorporates it into its response to the user.

**Acceptance Scenarios**:

1. **Given** the AI agent is configured with tool calling enabled, **When** the AI determines a tool is needed, **Then** it emits a tool call with the tool name and arguments
2. **Given** a tool call is emitted, **When** the system receives it, **Then** it executes the corresponding tool implementation, captures the output, and returns it to the AI as a tool result
3. **Given** the AI receives a tool result, **When** it processes the result, **Then** it can either respond to the user with a synthesized answer, call another tool, or chain further actions
4. **Given** a tool execution fails (timeout, permission error, runtime error), **When** the failure is reported to the AI, **Then** the AI informs the user about the failure in a human-friendly way and suggests alternatives if possible
5. **Given** a tool call would be dangerous or is disallowed by configuration, **When** the tool call is intercepted, **Then** the system blocks execution and returns an error to the AI explaining the restriction
6. **Given** tool calling is not enabled in the configuration, **When** the AI attempts to call a tool, **Then** the tool call is ignored and the AI is instructed to respond with text only

---

### User Story 5 - Conversation Management (Priority: P5)

Users can manage their conversation history with the bot. A sender can clear their conversation by sending a designated command (e.g., "/clear" or "/reset"). The bot owner can view and manage active conversations via `closeclaw agent conversations`. Stale conversations are automatically cleaned up after a configurable inactivity period.

**Why this priority**: As conversations accumulate, context windows fill up and storage grows. Management tools prevent resource waste and give both senders and owners control over conversation state.

**Independent Test**: Send several messages to build conversation history. Send "/clear" and verify the next message starts without prior context. As the owner, run `closeclaw agent conversations` and verify active conversations are listed. Wait for the inactivity timeout and verify stale conversations are pruned.

**Acceptance Scenarios**:

1. **Given** an ongoing conversation, **When** the sender sends "/clear", **Then** the conversation history for that sender is erased and the bot confirms the reset
2. **Given** active conversations exist, **When** the owner runs `closeclaw agent conversations`, **Then** the system displays a list showing sender platform, sender ID, message count, and last activity time
3. **Given** a conversation has been inactive beyond the configured timeout (default: 24 hours), **When** the cleanup runs, **Then** the stale conversation is automatically removed
4. **Given** the sender sends a message after their conversation was cleared or expired, **When** the AI processes it, **Then** it starts a fresh conversation with no prior history (system prompt still applies)

---

### Edge Cases

- What happens when the AI provider's API rate limit is exceeded? The system queues messages and retries with exponential backoff; the sender sees a "processing..." acknowledgment if the response takes longer than 5 seconds
- What happens when a message is extremely long (exceeds model's input token limit)? The system truncates or rejects the message with a clear explanation to the sender about the maximum message length
- What happens when two messages from the same sender arrive in rapid succession? Messages are processed sequentially per sender to prevent race conditions on conversation history
- What happens when the configured model is removed or renamed by the provider? The gateway logs a clear error at startup or on first request, and the operator is notified to reconfigure via `closeclaw agent configure`
- What happens when the Ollama server is not running? The test request during configuration fails with a clear message ("Cannot connect to Ollama at http://localhost:11434"); during runtime, the bot replies with a transient error message
- What happens when the AI's response is empty? The system sends a fallback message to the sender (e.g., "I processed your message but have nothing to say.") and logs a warning
- What happens when a tool call enters an infinite loop (AI keeps calling tools)? The system enforces a maximum tool call depth per turn (default: 10); if exceeded, the AI is forced to produce a final text response

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide a `closeclaw agent configure` command to set up the AI model provider, model selection (via a list of popular models per provider with a "Custom" free-text option), and credentials
- **FR-002**: The system MUST support the following AI providers: OpenAI, Anthropic Claude, Google Gemini, Ollama (local), Kimi (Moonshot AI), and any OpenAI-compatible endpoint via a custom base URL
- **FR-003**: The system MUST validate the AI provider configuration by making a lightweight test request before saving
- **FR-004**: The AI agent configuration MUST be persisted in `~/.closeclaw/config.json` under a dedicated `agent` section without overwriting existing bot or gateway settings
- **FR-005**: The system MUST provide a `closeclaw agent system-prompt` command to set, view, and update the AI's system prompt
- **FR-006**: When the gateway is running with an AI agent configured, approved messages MUST be forwarded to the configured AI model for processing
- **FR-007**: The AI model's text response MUST be sent back to the sender via the bot's DM channel
- **FR-008**: The system MUST maintain per-sender conversation history and include it in AI requests to provide contextual awareness
- **FR-009**: Conversation history MUST be trimmed when it exceeds the configured context window, keeping the most recent messages
- **FR-010**: When the AI model is unreachable or returns an error, the bot MUST send a user-friendly error message to the sender and log the error for the operator
- **FR-011**: When no AI agent is configured, the gateway MUST continue to operate as before (logging approved messages without AI processing) — full backward compatibility with feature 001
- **FR-012**: The system MUST support tool calling: the AI can request execution of predefined tools, and the system executes them and returns results
- **FR-013**: Tool execution MUST enforce a maximum call depth per conversation turn (default: 10) to prevent infinite loops
- **FR-014**: The system MUST provide built-in tools for common automation actions: shell command execution, HTTP requests, and date/time retrieval
- **FR-015**: Tool execution MUST be gated by configuration — the owner must explicitly enable tool calling and can restrict which tools are available
- **FR-016**: The sender MUST be able to clear their conversation history by sending a "/clear" command
- **FR-017**: The system MUST provide a `closeclaw agent conversations` command to list active conversations with sender details and activity timestamps
- **FR-018**: Stale conversations MUST be automatically cleaned up after a configurable inactivity period (default: 24 hours)
- **FR-019**: Messages from the same sender MUST be processed sequentially to prevent race conditions on conversation history
- **FR-020**: When the AI provider rate limit is exceeded, the system MUST queue the message and retry with backoff, sending a "processing" acknowledgment if the response is delayed beyond 5 seconds
- **FR-021**: The system MUST enforce a maximum input message length based on the model's token limit and reject oversized messages with a clear explanation
- **FR-022**: The system MUST use a sensible default system prompt ("You are CloseClaw, a helpful AI assistant.") when none is explicitly configured
- **FR-023**: The `closeclaw agent configure` command MUST handle reconfiguration gracefully — showing current settings and allowing the user to change or keep them

### Key Entities

- **AgentConfig**: The AI agent configuration. Attributes: provider name, model name, API key (encrypted at rest), base URL (for custom endpoints or Ollama), system prompt, tool calling enabled flag, max context window (token count), max tool call depth
- **Conversation**: An ongoing message exchange between a specific sender and the AI. Attributes: sender platform, sender ID, message history (list of role/content pairs), created timestamp, last activity timestamp, total token count estimate
- **ConversationMessage**: A single message within a conversation. Attributes: role (system, user, assistant, tool), content (text), tool call metadata (if role is assistant with tool call), tool result (if role is tool), timestamp
- **ToolDefinition**: A tool available for the AI to call. Attributes: name, description, parameter schema, enabled flag, execution handler reference
- **ToolCall**: An AI-initiated request to execute a tool. Attributes: tool name, arguments, call ID
- **ToolResult**: The output of a tool execution. Attributes: call ID, success flag, output text, error message (if failed)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user completes AI agent configuration in under 3 minutes, including provider selection, credential entry, and validation
- **SC-002**: An approved sender receives an AI-generated response to their message within 10 seconds (excluding model inference time at the provider)
- **SC-003**: Conversation context is correctly maintained — the AI demonstrates awareness of at least the 10 most recent exchanges in a conversation
- **SC-004**: When the AI provider is unreachable, 100% of affected senders receive a human-friendly error message within 5 seconds
- **SC-005**: Tool calls execute and return results to the AI within 30 seconds; the sender receives the final synthesized response promptly after
- **SC-006**: The system supports at least 6 distinct AI providers (OpenAI, Anthropic, Gemini, Ollama, Kimi, custom OpenAI-compatible) without code changes for adding new OpenAI-compatible providers
- **SC-007**: Stale conversations are automatically cleaned up and do not accumulate beyond the configured inactivity period
- **SC-008**: The gateway continues to function correctly when no AI agent is configured — zero regressions from feature 001

## Assumptions

- Users have completed bot onboarding (feature 001) and have at least one bot configured with the gateway operational before configuring an AI agent
- For cloud AI providers (OpenAI, Anthropic, Gemini, Kimi), users have their own accounts and API keys; CloseClaw does not provide or manage provider accounts
- Ollama is available for local/offline AI processing without requiring API keys or cloud accounts; users are responsible for installing and running Ollama
- API keys are stored in the local configuration file; encryption at rest is desirable but file-system-level encryption (e.g., FileVault, LUKS) is the user's responsibility in v1
- Tool calling is opt-in and disabled by default for safety; the built-in shell command tool requires explicit enablement due to security implications
- The "Kimi" provider refers to Moonshot AI's Kimi API, which exposes an OpenAI-compatible chat completions interface
- Conversation history is stored in memory during the gateway's lifetime and not persisted to disk in v1; restarting the gateway clears all conversation history
- The context window configuration refers to the approximate token limit; exact tokenization depends on the model and is estimated, not precisely counted
- This feature does not include a web UI — all configuration and management is CLI-based, consistent with feature 001
- Message processing is single-threaded per sender but concurrent across different senders
