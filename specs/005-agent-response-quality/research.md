# Research: Agent Response Quality

## R1: Telegram Formatting Approach — HTML vs MarkdownV2

**Decision**: Use Telegram HTML parse_mode

**Rationale**: HTML is more forgiving and predictable than MarkdownV2 for programmatic generation. MarkdownV2 requires escaping 18 special characters (`_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!`) which makes it fragile when converting AI-generated markdown. HTML tags are explicit and don't conflict with content characters.

**Alternatives considered**:
- MarkdownV2: Too fragile for AI-generated content; special character escaping is error-prone
- Plain text (no parse_mode): Current approach; loses all formatting
- Entity-based (MessageEntity objects): Complex to generate, no benefit over HTML for text-only messages

**Telegram HTML supported tags** (as of Bot API 9.5):
- `<b>`, `<strong>` — bold
- `<i>`, `<em>` — italic
- `<u>`, `<ins>` — underline
- `<s>`, `<strike>`, `<del>` — strikethrough
- `<span class="tg-spoiler">` — spoiler
- `<a href="URL">` — links
- `<code>` — inline code
- `<pre>` — preformatted block
- `<pre><code class="language-xxx">` — syntax-highlighted code block
- `<blockquote>` — block quote
- `<blockquote expandable>` — expandable block quote

**Escaping rules**: All `<`, `>`, `&` not part of tags must become `&lt;`, `&gt;`, `&amp;`.

**Message limit**: 4096 characters per message (after entity parsing).

## R2: Markdown-to-Telegram Conversion Strategy

**Decision**: Build a lightweight regex-based converter (no AST parser dependency)

**Rationale**: AI responses use a predictable subset of markdown (headers, bold, italic, code blocks, tables, links, lists). A focused converter covering this subset is simpler, faster, and avoids adding a dependency like `marked` or `remark`. The conversion runs on every message, so it must be fast (<10ms).

**Conversion rules**:

| Markdown | Telegram HTML |
| --- | --- |
| `# Heading` | `<b>Heading</b>` (all levels) |
| `**bold**` | `<b>bold</b>` |
| `*italic*` / `_italic_` | `<i>italic</i>` |
| `~~strikethrough~~` | `<s>strikethrough</s>` |
| `` `inline code` `` | `<code>inline code</code>` |
| ` ```lang\ncode\n``` ` | `<pre><code class="language-lang">code</code></pre>` |
| `[text](url)` | `<a href="url">text</a>` |
| `> blockquote` | `<blockquote>blockquote</blockquote>` |
| `\| table \|` | Converted to aligned plain text (Telegram has no table support) |
| `- list item` | `• list item` (bullet replacement) |
| `1. numbered` | Keep as-is (numbers are naturally readable) |
| `---` (horizontal rule) | `———` (em-dash line) |

**Processing order**: Code blocks first (to protect their content from other transformations), then inline code, then block-level elements, then inline formatting, then escaping of remaining special HTML characters.

**Alternatives considered**:
- `marked` library: Full AST parser; overkill for this subset, adds dependency
- `remark` / `unified`: Heavy ecosystem; academic for our use case
- Telegram MarkdownV2 passthrough: Requires escaping 18 chars; fragile

## R3: Message Splitting Strategy

**Decision**: Split at paragraph boundaries before the 4096-char limit

**Rationale**: Splitting mid-sentence or mid-formatting creates broken messages. Paragraph boundaries (`\n\n`) are natural split points that preserve readability. If a single paragraph exceeds the limit (e.g., a large code block), fall back to splitting at line boundaries.

**Algorithm**:
1. If message ≤ 4096 chars, send as-is
2. Split at `\n\n` boundaries, accumulating chunks up to 4096
3. If a single paragraph > 4096, split at `\n` boundaries
4. If a single line > 4096, hard-split at 4096 (with HTML tag repair)
5. Ensure open HTML tags are closed before each split and re-opened after

## R4: Scheduled Task Response Suppression

**Decision**: Classify AI responses as "actionable" vs "interim" using keyword-based heuristics, and suppress interim responses

**Rationale**: OpenClaw's approach of suppressing "on it" / "pulling everything together" interim text and only delivering the final answer is the right model. For CloseClaw, the suppression filter runs between the AI response and the `deliver()` function in the task scheduler. The filter classifies responses using signal keywords.

**Suppression signals** (response is interim / suppress it):
- Contains phrases: "still running", "in progress", "no change", "no update", "checking", "waiting for", "polling", "monitoring", "not yet", "same as before", "no new"
- Response is very short (< 50 chars) and lacks completion keywords
- Response starts with "HEARTBEAT_OK" (already handled, but included for completeness)

**Delivery signals** (response is actionable / deliver it):
- Contains completion phrases: "done", "finished", "completed", "succeeded", "failed", "error", "deployed", "built", "ready"
- Contains explicit user-directed content: "here are", "results", "summary", "report"
- Response length > 200 chars (substantial content is likely meaningful)

**Safety valve**: If a task has been suppressed for > 30 minutes (configurable), deliver the next response regardless of classification, with a prefix like "Status update:" so the user knows monitoring is still active.

**Data model addition**: `ScheduledTask` gains `lastDeliveredAt: string | undefined` to track when the last response was actually delivered (vs. just run).

**Alternatives considered**:
- LLM-based classification: Using the AI to classify its own output adds latency and cost; keyword heuristics are sufficient
- User-controlled suppression flag per task: Too complex for now; can be added later
- Only deliver on task completion (no interim at all): Too aggressive; the 30-minute safety valve is needed

## R5: Enhanced System Prompt Design

**Decision**: Build a multi-section default system prompt inspired by OpenClaw's structure

**Rationale**: OpenClaw's system prompt has dedicated sections for identity, tooling, safety, workspace, runtime, and heartbeat behavior. The current CloseClaw prompt ("You are CloseClaw, a helpful AI assistant.") provides zero behavioral guidance. A structured prompt dramatically improves response quality.

**Prompt sections** (in order):

1. **Identity**: Who the agent is, its purpose, its personality (concise, direct, no filler)
2. **Response Style**: Conciseness rules — short answers for simple questions, structured formatting for complex ones; prefer bullet points over prose; never start with "Great question" or "I'd be happy to help"
3. **Platform Awareness**: The agent knows it's on Telegram/Discord and adjusts — shorter messages for mobile, avoid huge tables, use formatting the platform supports
4. **Tool Usage**: When to use tools proactively (e.g., use datetime tool instead of guessing the date, use HTTP instead of speculating about API responses)
5. **Scheduling Behavior**: Guidelines for when to use `schedule_task` vs. answering immediately; monitoring tasks should return "TASK_COMPLETE: [result]" or "TASK_IN_PROGRESS: [status]" to enable suppression
6. **Preferences**: Respect stored user preferences for verbosity, style, etc.

**User prompt augmentation**: The user's custom `systemPrompt` from config is prepended as "Additional instructions from the owner:" before the built-in sections. This ensures user customization takes priority while still providing baseline behavioral guidance.

**Alternatives considered**:
- Replace user prompt entirely with built-in: Breaks existing user configurations
- Put built-in prompt in a separate file (like OpenClaw's SOUL.md): Adds file I/O on every message; unnecessary for now
- Make each section configurable: YAGNI; the prompt is code-maintained

## R6: Suppression Protocol for Scheduled Tasks

**Decision**: Use structured prefixes in the system prompt to enable reliable classification

**Rationale**: Instead of relying purely on keyword heuristics (fragile), the system prompt instructs the AI to prefix scheduled task responses with structured tokens:
- `TASK_COMPLETE:` — task is done, deliver immediately
- `TASK_FAILED:` — task failed, deliver immediately
- `TASK_IN_PROGRESS:` — no meaningful change, suppress

The suppression filter first checks for these prefixes (reliable). If no prefix is found, it falls back to keyword heuristics (best-effort). The prefix is stripped before delivery to the user.

**Alternatives considered**:
- JSON-structured responses: Too rigid; breaks natural language flow
- Separate tool call for signaling: Overengineered; a prefix is simpler
- No protocol, pure heuristics: Too unreliable for production use
