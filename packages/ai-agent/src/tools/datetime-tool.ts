import { z } from "zod";
import { tool } from "ai";

export function createDatetimeTool() {
  return tool({
    description: "Get the current date and time with timezone information",
    parameters: z.object({}),
    execute: async () => {
      const now = new Date();
      return {
        iso: now.toISOString(),
        unix: Math.floor(now.getTime() / 1000),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        formatted: now.toLocaleString(),
      };
    },
  });
}
