export interface DetectedPrompt {
  promptText: string;
  lineIndex: number;
}

const PROMPT_PATTERNS = [
  /\bAccept\s+Deny\b/i,
  /\(a\)ccept\s+\(d\)eny/i,
  /\bAccept\s+Reject\b/i,
  /\bAllow\s+Deny\b/i,
  /\bApprove\s+Reject\b/i,
];

function matchesPromptPattern(line: string): boolean {
  return PROMPT_PATTERNS.some((p) => p.test(line));
}

function extractContext(lines: string[], promptIdx: number): string {
  const start = Math.max(0, promptIdx - 3);
  return lines
    .slice(start, promptIdx)
    .filter((l) => l.trim().length > 0)
    .join("\n");
}

export function detectPermissionPrompt(
  output: string,
): DetectedPrompt | null {
  if (output.trim().length === 0) return null;
  const lines = output.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (matchesPromptPattern(lines[i])) {
      const context = extractContext(lines, i);
      return { promptText: context, lineIndex: i };
    }
  }
  return null;
}
