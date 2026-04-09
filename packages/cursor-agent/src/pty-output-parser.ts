const SGR_PATTERN = new RegExp("\x1b\\[[0-9;]*[a-zA-Z]", "g");
const OSC_PATTERN = new RegExp("\x1b\\][^\x07]*\x07", "g");
const CARRIAGE_RETURN = new RegExp("\r", "g");

export function stripAnsi(text: string): string {
  return text
    .replace(SGR_PATTERN, "")
    .replace(OSC_PATTERN, "")
    .replace(CARRIAGE_RETURN, "");
}

export interface LineBuffer {
  push(chunk: string): string[];
  flush(): string;
}

export function createLineBuffer(): LineBuffer {
  let remainder = "";

  return {
    push(chunk) {
      const data = remainder + chunk;
      const parts = data.split("\n");
      remainder = parts.pop() ?? "";
      return parts.map((p) => p.replace(/\r$/, ""));
    },
    flush() {
      const leftover = remainder;
      remainder = "";
      return leftover;
    },
  };
}
