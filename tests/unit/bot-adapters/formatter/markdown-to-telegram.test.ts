import { describe, it, expect } from "vitest";
import { formatForTelegram } from "../../../../packages/bot-adapters/src/formatter/markdown-to-telegram.js";

describe("formatForTelegram", () => {
  it("returns empty text unchanged with no parseMode", () => {
    const result = formatForTelegram("   ");
    expect(result.text).toBe("   ");
    expect(result.parseMode).toBeUndefined();
  });

  it("converts markdown headers to bold", () => {
    expect(formatForTelegram("# Title").text).toContain("<b>Title</b>");
    expect(formatForTelegram("## Sub").text).toContain("<b>Sub</b>");
    expect(formatForTelegram("### Deep").text).toContain("<b>Deep</b>");
  });

  it("converts bold markdown to HTML bold", () => {
    const { text } = formatForTelegram("This is **bold** text");
    expect(text).toContain("<b>bold</b>");
  });

  it("converts italic with underscores", () => {
    const { text } = formatForTelegram("This is _italic_ text");
    expect(text).toContain("<i>italic</i>");
  });

  it("converts italic with single asterisks", () => {
    const { text } = formatForTelegram("This is *italic* text");
    expect(text).toContain("<i>italic</i>");
  });

  it("converts strikethrough", () => {
    const { text } = formatForTelegram("This is ~~struck~~ text");
    expect(text).toContain("<s>struck</s>");
  });

  it("converts inline code", () => {
    const { text } = formatForTelegram("Use `npm install` here");
    expect(text).toContain("<code>npm install</code>");
  });

  it("converts fenced code blocks with language", () => {
    const md = "```python\nprint('hi')\n```";
    const { text } = formatForTelegram(md);
    expect(text).toContain('<pre><code class="language-python">');
    expect(text).toContain("print(");
  });

  it("converts fenced code blocks without language", () => {
    const md = "```\nconst x = 1;\n```";
    const { text } = formatForTelegram(md);
    expect(text).toContain("<pre>");
    expect(text).not.toContain('class="language-"');
  });

  it("converts markdown links to HTML anchors", () => {
    const { text } = formatForTelegram("[Google](https://google.com)");
    expect(text).toContain('<a href="https://google.com">Google</a>');
  });

  it("converts blockquotes", () => {
    const { text } = formatForTelegram("> This is a quote");
    expect(text).toContain("<blockquote>This is a quote</blockquote>");
  });

  it("converts markdown tables to readable text", () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const { text } = formatForTelegram(md);
    expect(text).toContain("A");
    expect(text).toContain("B");
    expect(text).not.toContain("---");
  });

  it("converts unordered lists to bullet points", () => {
    const { text } = formatForTelegram("- item one\n- item two");
    expect(text).toContain("• item one");
    expect(text).toContain("• item two");
  });

  it("converts horizontal rules to em-dash line", () => {
    const { text } = formatForTelegram("---");
    expect(text).toContain("———");
  });

  it("escapes HTML entities in regular text", () => {
    const { text } = formatForTelegram("x < 5 & y > 3");
    expect(text).toContain("&lt;");
    expect(text).toContain("&amp;");
    expect(text).toContain("&gt;");
  });

  it("preserves emoji in output", () => {
    const { text } = formatForTelegram("Hello! 🎉🔥");
    expect(text).toContain("🎉");
    expect(text).toContain("🔥");
  });

  it("always sets parseMode to HTML for non-empty input", () => {
    const { parseMode } = formatForTelegram("hello");
    expect(parseMode).toBe("HTML");
  });

  it("does not mangle code block content with markdown syntax", () => {
    const md = "```\n**not bold** _not italic_\n```";
    const { text } = formatForTelegram(md);
    expect(text).not.toContain("<b>");
    expect(text).not.toContain("<i>");
  });
});
