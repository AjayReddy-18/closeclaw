import type { Configuration, AgentConfig } from "@closeclaw/shared-types";
import { ConfigReadError } from "../config/config-reader.js";

export function formatErr(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function readExistingConfig(
  readConfig: (path: string) => Configuration | null,
  configPath: string,
): Configuration | null {
  try {
    const c = readConfig(configPath);
    if (c === null) {
      console.error(
        `Configuration not found: ${configPath}. Run closeclaw onboard first.`,
      );
    }
    return c;
  } catch (e: unknown) {
    if (e instanceof ConfigReadError) {
      console.error(e.message);
      return null;
    }
    throw e;
  }
}

export function logCurrentAgent(agent: AgentConfig): void {
  console.log("Current agent configuration:");
  console.log(`  Provider: ${agent.provider}`);
  console.log(`  Model: ${agent.model}`);
  if (agent.baseUrl) console.log(`  Base URL: ${agent.baseUrl}`);
  if (agent.apiKey) console.log("  API key: (set)");
  const t = agent.tools;
  const toolLine = t.enabled
    ? t.allowedTools.length > 0
      ? t.allowedTools.join(", ")
      : "(none selected)"
    : "off";
  console.log(`  Tools: ${toolLine}`);
}

export function persistAgent(
  writeConfig: (path: string, config: Configuration) => void,
  configPath: string,
  existing: Configuration,
  agent: AgentConfig,
): void {
  writeConfig(configPath, {
    ...existing,
    lastModified: new Date().toISOString(),
    agent,
  });
}
