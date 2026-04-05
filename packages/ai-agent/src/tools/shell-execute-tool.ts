import { z } from "zod";
import { tool } from "ai";
import { exec } from "node:child_process";
import type { ExecException } from "node:child_process";

const MAX_OUTPUT_LENGTH = 10_000;

function truncateOutput(text: string): string {
  if (text.length <= MAX_OUTPUT_LENGTH) return text;
  return text.slice(0, MAX_OUTPUT_LENGTH) + "...[truncated]";
}

function exitCodeFromExecError(error: ExecException | null): number {
  if (error == null) return 0;
  return typeof error.status === "number" ? error.status : 1;
}

export function createShellExecuteTool() {
  return tool({
    description:
      "Execute a shell command and return stdout, stderr, and exit code",
    parameters: z.object({
      command: z.string().describe("Shell command to execute"),
      workingDirectory: z
        .string()
        .optional()
        .describe("Working directory for the command"),
    }),
    execute: async ({ command, workingDirectory }) =>
      new Promise<{ exitCode: number; stdout: string; stderr: string }>(
        (resolve) => {
          exec(command, { cwd: workingDirectory }, (error, stdout, stderr) => {
            resolve({
              exitCode: exitCodeFromExecError(error),
              stdout: truncateOutput(stdout),
              stderr: truncateOutput(stderr),
            });
          });
        },
      ),
  });
}
