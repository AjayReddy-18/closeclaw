# Response Formatting

AI responses are automatically formatted for the target messaging
platform before delivery.

## Telegram

Telegram messages are converted from markdown to Telegram-compatible
HTML using `parse_mode: "HTML"`.

### Conversion Rules

| Markdown              | Telegram HTML                                     |
| --------------------- | ------------------------------------------------- |
| `# Heading`           | `<b>Heading</b>` (all levels)                     |
| `**bold**`            | `<b>bold</b>`                                     |
| `*italic*` / `_it_`   | `<i>italic</i>`                                   |
| `~~strikethrough~~`   | `<s>strikethrough</s>`                            |
| `` `inline code` ``   | `<code>inline code</code>`                        |
| ` ```lang\n...\n``` ` | `<pre><code class="language-lang">…</code></pre>` |
| `[text](url)`         | `<a href="url">text</a>`                          |
| `> blockquote`        | `<blockquote>blockquote</blockquote>`             |
| `\| table \|`         | Converted to readable plain text                  |
| `- list item`         | `• list item`                                     |
| `---`                 | `———` (em-dash line)                              |

### Processing Order

1. Fenced code blocks are extracted and protected from further
   transformation
2. Inline code is extracted and protected
3. Block-level elements are converted (headers, blockquotes,
   tables, horizontal rules, lists)
4. Inline formatting is applied (bold, italic, strikethrough,
   links)
5. Remaining `<`, `>`, `&` characters are HTML-escaped

### Message Splitting

Telegram limits messages to 4096 characters. Long responses are
automatically split:

1. Split at paragraph boundaries (`\n\n`)
2. If a single paragraph exceeds the limit, split at line
   boundaries (`\n`)
3. If a single line exceeds the limit, hard-split at the
   character limit
4. Open HTML tags are closed before each split point and
   re-opened after

### Fallback Behavior

If the Telegram API rejects an HTML-formatted message (e.g., due
to malformed tags), the adapter automatically retries with plain
text (no parse_mode).

## Discord

Discord natively supports markdown rendering. AI responses are
passed through without conversion. The `SendMessageOptions.parseMode`
is ignored for Discord.

## Adding a New Platform

To add formatting for a new platform:

1. Create a new formatter in `packages/bot-adapters/src/formatter/`
2. Wire it into the platform's adapter `sendMessage` method
3. Add tests following the existing pattern
