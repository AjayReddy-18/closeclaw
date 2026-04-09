const CONTINUATION_PATTERNS = [
  /\blet me (?:check|search|look|find|get|fetch|query|try|see)\b/i,
  /\bi(?:'ll| will) (?:check|search|look|find|get|fetch|query|try|see)\b/i,
  /\blet me (?:also|now|first)\b/i,
  /\bi need to (?:check|search|look|find|get|fetch|query)\b/i,
  /\bsearching (?:for|now)\b/i,
  /\bchecking (?:now|that|this|the)\b/i,
  /\blooking (?:into|for|at) (?:it|this|that|the)\b/i,
];

const MAX_CONTINUATION_ROUNDS = 3;

interface StepInfo {
  toolCalls?: unknown[];
  text?: string;
}

function hasToolCallsInSteps(steps: StepInfo[]): boolean {
  return steps.some(
    (s) => Array.isArray(s.toolCalls) && s.toolCalls.length > 0,
  );
}

function textMatchesContinuationPattern(text: string): boolean {
  return CONTINUATION_PATTERNS.some((pattern) => pattern.test(text));
}

export function shouldContinue(
  responseText: string,
  steps: StepInfo[],
  roundsSoFar: number,
): boolean {
  if (roundsSoFar >= MAX_CONTINUATION_ROUNDS) return false;
  if (!hasToolCallsInSteps(steps)) return false;
  return textMatchesContinuationPattern(responseText);
}

export { MAX_CONTINUATION_ROUNDS };
