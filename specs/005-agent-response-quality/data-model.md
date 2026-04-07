# Data Model: Agent Response Quality

## Modified Entities

### ScheduledTask (existing — modified)

New field added to track suppression state:

| Field | Type | Description |
| --- | --- | --- |
| lastDeliveredAt | string (ISO 8601) or undefined | Timestamp of the last response actually delivered to the user (not just executed) |

All other fields remain unchanged.

### AgentConfig (existing — modified)

| Field | Change | Description |
| --- | --- | --- |
| systemPrompt | Semantic change | User-provided prompt becomes "additional instructions" that augments the built-in default prompt. Default value changes from single line to empty string (built-in prompt is always present). |

## New Entities

### FormatterResult

Represents the output of the platform-specific formatting pipeline.

| Field | Type | Description |
| --- | --- | --- |
| text | string | The formatted text ready for delivery |
| parseMode | "HTML" or undefined | The parse_mode parameter to pass to the platform API (undefined = plain text) |

### MessageChunk

Represents a single message after splitting for platform limits.

| Field | Type | Description |
| --- | --- | --- |
| text | string | Message text content |
| parseMode | "HTML" or undefined | Inherited from the parent FormatterResult |

### SuppressionResult

Represents the decision of the suppression filter.

| Field | Type | Description |
| --- | --- | --- |
| shouldDeliver | boolean | Whether the response should be sent to the user |
| reason | string | Why the decision was made (for logging) |
| cleanedResponse | string or undefined | The response with protocol prefixes stripped (if delivering) |

## State Transitions

### Suppression Filter Decision Flow

```
AI Response → Check for structured prefix → Found?
  ├─ Yes: TASK_COMPLETE / TASK_FAILED → deliver (strip prefix)
  ├─ Yes: TASK_IN_PROGRESS → suppress
  └─ No: Keyword heuristic fallback
       ├─ Completion keywords detected → deliver
       ├─ Interim keywords detected → suppress
       └─ Ambiguous → check last delivery time
            ├─ > 30 min since last delivery → deliver (safety valve)
            └─ ≤ 30 min → suppress
```
