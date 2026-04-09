import type { DetectedPermission } from "./types.js";

const PROMPT_PATTERNS = [
  /\bAccept\s+Deny\b/i,
  /\(a\)ccept\s+\(d\)eny/i,
  /\bAccept\s+Reject\b/i,
  /\bAllow\s+Deny\b/i,
  /\bApprove\s+Reject\b/i,
  /\(Y\/n\)/,
  /\(y\/N\)/,
  /\[Y\/n\]/,
  /\[y\/N\]/,
  /Do you want to proceed\?/i,
  /Are you sure\?/i,
  /Do you trust the contents of this directory\?/i,
  /\bYes\s+No\b/,
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

function buildDisplayText(context: string, promptLine: string): string {
  if (context.length > 0) return context;
  return promptLine.trim();
}

export function detectPtyPermission(
  recentLines: string[],
): DetectedPermission | null {
  if (recentLines.length === 0) return null;
  for (let i = 0; i < recentLines.length; i++) {
    if (!matchesPromptPattern(recentLines[i])) continue;
    const context = extractContext(recentLines, i);
    return {
      promptText: recentLines[i],
      displayText: buildDisplayText(context, recentLines[i]),
    };
  }
  return null;
}
