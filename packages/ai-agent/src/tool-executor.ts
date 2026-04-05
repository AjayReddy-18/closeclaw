import type { ToolConfig, ToolName } from "@closeclaw/shared-types";
import { createDatetimeTool } from "./tools/datetime-tool.js";
import { createHttpRequestTool } from "./tools/http-request-tool.js";
import { createShellExecuteTool } from "./tools/shell-execute-tool.js";

type BuiltTool = ReturnType<typeof createDatetimeTool>;
type ToolMap = Record<string, BuiltTool>;

const TOOL_FACTORIES: Record<ToolName, () => BuiltTool> = {
  datetime: createDatetimeTool,
  http_request: createHttpRequestTool,
  shell_execute: createShellExecuteTool,
};

export function buildToolMap(config: ToolConfig): ToolMap {
  if (!config.enabled) return {};
  const tools: ToolMap = {};
  for (const name of config.allowedTools) {
    const factory = TOOL_FACTORIES[name];
    if (factory) {
      tools[name] = factory();
    }
  }
  return tools;
}
