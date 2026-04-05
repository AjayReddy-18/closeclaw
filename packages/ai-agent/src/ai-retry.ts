import { generateText } from "ai";
import { EMPTY_RESPONSE_MESSAGE } from "./message-processor-types.js";

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function errorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const r = error as Record<string, unknown>;
  const s = r["statusCode"] ?? r["status"];
  return typeof s === "number" ? s : undefined;
}

export function isRateLimitError(error: unknown): boolean {
  if (errorStatus(error) === 429) return true;
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return msg.toLowerCase().includes("rate limit");
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  initialDelayMs: number,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries && isRateLimitError(error)) {
        await delay(initialDelayMs * Math.pow(2, attempt));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export function extractResponseText(
  result: Awaited<ReturnType<typeof generateText>>,
): string {
  if (result.text && result.text.trim().length > 0) return result.text;
  const steps = (result as Record<string, unknown>).steps;
  if (Array.isArray(steps)) {
    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i] as Record<string, unknown>;
      if (typeof step.text === "string" && step.text.trim().length > 0) {
        return step.text;
      }
    }
  }
  return EMPTY_RESPONSE_MESSAGE;
}
