# Data Model: Persistent Conversation Storage

## Entities

### ConversationFile

A JSON file representing a single sender's persisted conversation state.

**Location**: `~/.closeclaw/conversations/<platform>-<senderId>.json`

**Schema**:

```text
{
  platform: string (BotPlatform enum value)
  senderId: string
  senderDisplayName?: string
  compressedSummary?: {
    text: string
    messagesCompressed: number
    compressedAt: string (ISO 8601)
  }
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool"
    content: string
    timestamp: string (ISO 8601)
    toolCallId?: string
    toolName?: string
  }>
  createdAt: string (ISO 8601)
  lastActivityAt: string (ISO 8601)
}
```

**Relationships**:

- One-to-one with in-memory `Conversation` (loaded/saved symmetrically)
- One-to-one with `PreferenceFile` (same sender key, separate directory)

**Validation**:

- `platform` must be a valid BotPlatform
- `senderId` must be non-empty
- `messages` must be an array (may be empty)
- `compressedSummary.text` must be non-empty if present

**State Transitions**:

- Created → on first message from a new sender
- Updated → after each message exchange (user + assistant)
- Compressed → when message count exceeds threshold; older messages replaced by summary
- Cleared → on "/clear" command (file truncated to empty conversation)
- Pruned → when stale conversation cleanup runs (file deleted)

### PreferenceFile

A JSON file storing a sender's durable preferences.

**Location**: `~/.closeclaw/preferences/<platform>-<senderId>.json`

**Schema**:

```text
{
  platform: string
  senderId: string
  preferences: Array<{
    key: string (category, e.g., "timezone", "name", "language")
    value: string (the preference text)
    updatedAt: string (ISO 8601)
  }>
  lastModifiedAt: string (ISO 8601)
}
```

**Relationships**:

- One-to-one with `ConversationFile` (same sender key)
- Independent lifecycle — not cleared by "/clear"

**Validation**:

- `preferences` must be an array
- Each preference must have a non-empty `key` and `value`
- Duplicate keys are not allowed; updates replace the existing value

**State Transitions**:

- Created → first time the AI identifies a preference for this sender
- Updated → when a new preference is identified or an existing one is changed
- Entry removed → when sender asks to forget a specific preference
- Never pruned by stale cleanup (preferences are permanent)

### Conversation (Updated)

The existing in-memory `Conversation` type gains an optional `compressedSummary` field.

**New field**:

```text
compressedSummary?: {
  text: string
  messagesCompressed: number
  compressedAt: Date
}
```

This field is populated when compression runs and serialized/deserialized with the `ConversationFile`.

### AgentConfig (Updated)

The existing `AgentConfig` type gains compression settings.

**New fields**:

```text
compressionThreshold: number (default: 50)
keepRecentCount: number (default: 20)
```

These control when compression triggers and how many recent messages to keep verbatim.

## File System Layout

```text
~/.closeclaw/
├── config.json                              # Existing (from feature 001)
├── pairing.json                             # Existing (from feature 001)
├── conversations/                           # NEW
│   ├── telegram-123456.json
│   ├── telegram-789012.json
│   └── discord-456789.json
└── preferences/                             # NEW
    ├── telegram-123456.json
    └── discord-456789.json
```
