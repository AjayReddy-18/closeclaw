import type { ToolName } from "./agent-config.js";

export interface ToolExecutionResult {
  success: boolean;
  output: string;
  errorMessage?: string;
  durationMs: number;
}

export interface ToolExecutionContext {
  callDepth: number;
  maxCallDepth: number;
  timeoutMs: number;
}

export interface ToolExecutor {
  getEnabledTools(allowedTools: ToolName[]): Record<string, unknown>;

  executeWithLimits(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult>;
}
