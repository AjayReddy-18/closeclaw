import { describe, it, expect } from "vitest";
import { formatForTelegram } from "../../packages/bot-adapters/src/formatter/markdown-to-telegram.js";
import { splitMessage } from "../../packages/bot-adapters/src/formatter/message-splitter.js";

describe("Response formatting end-to-end flow", () => {
  it("formats markdown and delivers HTML chunks", () => {
    const markdown = "# Report\n\n**Bold** and `code`\n\n- item 1\n- item 2";
    const formatted = formatForTelegram(markdown);
    expect(formatted.parseMode).toBe("HTML");
    const chunks = splitMessage(formatted);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].parseMode).toBe("HTML");
    expect(chunks[0].text).toContain("<b>");
    expect(chunks[0].text).toContain("<code>");
  });

  it("splits long messages into multiple chunks", () => {
    const longParagraph = "word ".repeat(1000);
    const markdown = `# Title\n\n${longParagraph}\n\n# Second`;
    const formatted = formatForTelegram(markdown);
    const chunks = splitMessage(formatted);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(4096);
      expect(chunk.parseMode).toBe("HTML");
    }
  });

  it("handles plain text without markdown gracefully", () => {
    const plain = "Just a simple text message.";
    const formatted = formatForTelegram(plain);
    const chunks = splitMessage(formatted);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain("Just a simple text message.");
  });
});
