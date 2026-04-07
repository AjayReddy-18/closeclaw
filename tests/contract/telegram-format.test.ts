import { describe, it, expect } from "vitest";
import { formatForTelegram } from "../../packages/bot-adapters/src/formatter/markdown-to-telegram.js";

const ALLOWED_TAGS = [
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ins",
  "s",
  "strike",
  "del",
  "code",
  "pre",
  "a",
  "blockquote",
  "span",
];

function extractTags(html: string): string[] {
  const matches = html.match(/<\/?([a-z]+)[\s>]/gi) ?? [];
  return matches.map((m) =>
    m
      .replace(/<\/?/, "")
      .replace(/[\s>].*/, "")
      .toLowerCase(),
  );
}

function hasUnescapedSpecialChars(html: string): boolean {
  const withoutTags = html.replace(/<[^>]+>/g, "");
  return (
    /[<>]/.test(withoutTags) ||
    /&(?!amp;|lt;|gt;|quot;|#x[0-9a-f]+;)/i.test(withoutTags)
  );
}

describe("Telegram HTML contract", () => {
  const samples = [
    "# Hello **world**",
    "Use `code` and ~~strike~~",
    "```python\nx = 1\n```",
    "[link](https://example.com)",
    "> a blockquote\n\ntext",
    "| A | B |\n| - | - |\n| 1 | 2 |",
    "A & B < C > D",
  ];

  it("only produces Telegram-supported HTML tags", () => {
    for (const md of samples) {
      const { text } = formatForTelegram(md);
      const tags = extractTags(text);
      for (const tag of tags) {
        expect(ALLOWED_TAGS).toContain(tag);
      }
    }
  });

  it("escapes special characters outside of tags", () => {
    for (const md of samples) {
      const { text } = formatForTelegram(md);
      expect(hasUnescapedSpecialChars(text)).toBe(false);
    }
  });

  it("sets parseMode to HTML for all non-empty inputs", () => {
    for (const md of samples) {
      const { parseMode } = formatForTelegram(md);
      expect(parseMode).toBe("HTML");
    }
  });
});
