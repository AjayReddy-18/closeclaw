export interface SuppressionContext {
  lastDeliveredAt: string | undefined;
  safetyValveMs: number;
}

export interface SuppressionResult {
  suppressed: boolean;
  cleanedResponse: string;
  reason: string;
}

const DEFAULT_SAFETY_VALVE_MS = 30 * 60 * 1000;

const PREFIX_COMPLETE = "TASK_COMPLETE:";
const PREFIX_FAILED = "TASK_FAILED:";
const PREFIX_IN_PROGRESS = "TASK_IN_PROGRESS:";
const HEARTBEAT_OK = "HEARTBEAT_OK";

const DELIVERY_KEYWORDS = [
  "done", "finished", "completed", "succeeded",
  "failed", "error", "deployed", "built", "ready",
  "here are", "results", "summary", "report",
];

const SUPPRESSION_KEYWORDS = [
  "still running", "in progress", "no change",
  "no update", "checking", "waiting for",
  "polling", "monitoring", "not yet",
  "same as before", "no new",
];

function stripPrefix(response: string, prefix: string): string {
  return response.slice(prefix.length).trim();
}

function checkStructuredPrefix(response: string): SuppressionResult | null {
  const trimmed = response.trimStart();
  if (trimmed.startsWith(PREFIX_COMPLETE)) {
    return {
      suppressed: false,
      cleanedResponse: stripPrefix(trimmed, PREFIX_COMPLETE),
      reason: "structured-prefix-complete",
    };
  }
  if (trimmed.startsWith(PREFIX_FAILED)) {
    return {
      suppressed: false,
      cleanedResponse: stripPrefix(trimmed, PREFIX_FAILED),
      reason: "structured-prefix-failed",
    };
  }
  if (trimmed.startsWith(PREFIX_IN_PROGRESS)) {
    return {
      suppressed: true,
      cleanedResponse: stripPrefix(trimmed, PREFIX_IN_PROGRESS),
      reason: "structured-prefix-in-progress",
    };
  }
  return null;
}

function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function checkKeywordHeuristics(response: string): SuppressionResult | null {
  if (containsAny(response, DELIVERY_KEYWORDS)) {
    return {
      suppressed: false,
      cleanedResponse: response,
      reason: "keyword-delivery-signal",
    };
  }
  if (containsAny(response, SUPPRESSION_KEYWORDS)) {
    return {
      suppressed: true,
      cleanedResponse: response,
      reason: "keyword-suppression-signal",
    };
  }
  if (response.trim().length > 200) {
    return {
      suppressed: false,
      cleanedResponse: response,
      reason: "substantial-content",
    };
  }
  return null;
}

function isSafetyValveExpired(context: SuppressionContext): boolean {
  if (!context.lastDeliveredAt) return true;
  const elapsed = Date.now() - new Date(context.lastDeliveredAt).getTime();
  return elapsed >= (context.safetyValveMs || DEFAULT_SAFETY_VALVE_MS);
}

export function evaluateResponse(
  response: string,
  context: SuppressionContext,
): SuppressionResult {
  if (!response.trim() || response.trim() === HEARTBEAT_OK) {
    return {
      suppressed: true,
      cleanedResponse: response,
      reason: "empty-or-heartbeat",
    };
  }

  const prefixResult = checkStructuredPrefix(response);
  if (prefixResult) return prefixResult;

  const keywordResult = checkKeywordHeuristics(response);
  if (keywordResult) {
    if (keywordResult.suppressed && isSafetyValveExpired(context)) {
      return {
        suppressed: false,
        cleanedResponse: `Status update: ${response}`,
        reason: "safety-valve-expired",
      };
    }
    return keywordResult;
  }

  if (isSafetyValveExpired(context)) {
    return {
      suppressed: false,
      cleanedResponse: response,
      reason: "ambiguous-safety-valve",
    };
  }

  return {
    suppressed: true,
    cleanedResponse: response,
    reason: "ambiguous-default-suppress",
  };
}
