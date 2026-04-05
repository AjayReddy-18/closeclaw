import { z } from "zod";
import { tool } from "ai";

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE"] as const;
const MAX_RESPONSE_LENGTH = 10_000;

function truncateBody(text: string): string {
  if (text.length <= MAX_RESPONSE_LENGTH) return text;
  return text.slice(0, MAX_RESPONSE_LENGTH) + "...[truncated]";
}

async function runRequest(
  method: (typeof HTTP_METHODS)[number],
  url: string,
  headers: Record<string, string> | undefined,
  body: string | undefined,
) {
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method !== "GET" ? body : undefined,
    });
    const text = await response.text();
    return {
      status: response.status,
      statusText: response.statusText,
      body: truncateBody(text),
    };
  } catch (error) {
    return {
      status: 0,
      statusText: "Request failed",
      body: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function createHttpRequestTool() {
  return tool({
    description: "Make an HTTP request to a URL and return the response",
    parameters: z.object({
      method: z.enum(HTTP_METHODS).describe("HTTP method"),
      url: z.string().url().describe("URL to request"),
      headers: z.record(z.string()).optional().describe("Request headers"),
      body: z.string().optional().describe("Request body"),
    }),
    execute: async ({ method, url, headers, body }) =>
      runRequest(method, url, headers, body),
  });
}
