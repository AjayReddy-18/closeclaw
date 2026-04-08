import { describe, it, expect } from "vitest";
import { splitMessage } from "../../../../packages/bot-adapters/src/formatter/message-splitter.js";

describe("splitMessage", () => {
  it("returns single chunk for short message", () => {
    const result = splitMessage({ text: "hello", parseMode: "HTML" });
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("hello");
    expect(result[0].parseMode).toBe("HTML");
  });

  it("returns single chunk for empty input", () => {
    const result = splitMessage({ text: "", parseMode: undefined });
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("");
  });

  it("splits at paragraph boundaries for long messages", () => {
    const para1 = "A".repeat(30);
    const para2 = "B".repeat(30);
    const text = `${para1}\n\n${para2}`;
    const result = splitMessage({ text, parseMode: "HTML" }, 40);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0].text).toContain("A");
    expect(result[1].text).toContain("B");
  });

  it("falls back to line splitting for long paragraphs", () => {
    const line1 = "A".repeat(30);
    const line2 = "B".repeat(30);
    const text = `${line1}\n${line2}`;
    const result = splitMessage({ text, parseMode: "HTML" }, 40);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("hard splits very long single lines", () => {
    const text = "X".repeat(100);
    const result = splitMessage({ text, parseMode: "HTML" }, 40);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.every((c) => c.text.length <= 40)).toBe(true);
  });

  it("preserves parseMode across all chunks", () => {
    const text = "A".repeat(50) + "\n\n" + "B".repeat(50);
    const result = splitMessage({ text, parseMode: "HTML" }, 40);
    expect(result.every((c) => c.parseMode === "HTML")).toBe(true);
  });

  it("passes through undefined parseMode", () => {
    const text = "A".repeat(50) + "\n\n" + "B".repeat(50);
    const result = splitMessage({ text, parseMode: undefined }, 40);
    expect(result.every((c) => c.parseMode === undefined)).toBe(true);
  });

  it("closes and reopens HTML tags across splits", () => {
    const text = "<b>" + "A".repeat(50) + "</b>";
    const result = splitMessage({ text, parseMode: "HTML" }, 40);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0].text).toContain("</b>");
    expect(result[1].text).toContain("<b>");
  });
});
