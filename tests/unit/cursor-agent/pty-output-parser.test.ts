import { describe, it, expect } from "vitest";
import { stripAnsi, createLineBuffer } from "@closeclaw/cursor-agent";

describe("stripAnsi", () => {
  it("removes SGR color codes", () => {
    expect(stripAnsi("\x1b[32mGreen\x1b[0m")).toBe("Green");
  });

  it("removes bold and underline codes", () => {
    expect(stripAnsi("\x1b[1mBold\x1b[0m \x1b[4mUnder\x1b[0m")).toBe(
      "Bold Under",
    );
  });

  it("removes cursor movement sequences", () => {
    expect(stripAnsi("\x1b[2A\x1b[3BHello\x1b[K")).toBe("Hello");
  });

  it("removes OSC sequences (title sets)", () => {
    expect(stripAnsi("\x1b]0;My Title\x07Content")).toBe("Content");
  });

  it("returns plain text unchanged", () => {
    expect(stripAnsi("No escape codes here")).toBe("No escape codes here");
  });

  it("handles empty string", () => {
    expect(stripAnsi("")).toBe("");
  });

  it("removes multi-param SGR sequences", () => {
    expect(stripAnsi("\x1b[38;5;196mRed\x1b[0m")).toBe("Red");
  });
});

describe("createLineBuffer", () => {
  it("extracts complete lines from a single chunk", () => {
    const buffer = createLineBuffer();
    const lines = buffer.push("line one\nline two\n");
    expect(lines).toEqual(["line one", "line two"]);
  });

  it("buffers partial lines across chunks", () => {
    const buffer = createLineBuffer();
    const first = buffer.push("partial");
    expect(first).toEqual([]);
    const second = buffer.push(" line\ncomplete\n");
    expect(second).toEqual(["partial line", "complete"]);
  });

  it("handles multiple newlines producing empty strings", () => {
    const buffer = createLineBuffer();
    const lines = buffer.push("a\n\nb\n");
    expect(lines).toEqual(["a", "", "b"]);
  });

  it("returns empty array when no newline present", () => {
    const buffer = createLineBuffer();
    expect(buffer.push("no newline")).toEqual([]);
  });

  it("flushes remaining buffer content", () => {
    const buffer = createLineBuffer();
    buffer.push("incomplete");
    expect(buffer.flush()).toBe("incomplete");
  });

  it("flushes empty when nothing buffered", () => {
    const buffer = createLineBuffer();
    expect(buffer.flush()).toBe("");
  });

  it("handles carriage return line feeds", () => {
    const buffer = createLineBuffer();
    const lines = buffer.push("line one\r\nline two\r\n");
    expect(lines).toEqual(["line one", "line two"]);
  });
});
