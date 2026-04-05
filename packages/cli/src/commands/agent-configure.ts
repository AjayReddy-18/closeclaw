import { homedir } from "node:os";
import { join } from "node:path";
import { ExitPromptError } from "@inquirer/core";
import { checkbox, confirm, input, password, select } from "@inquirer/prompts";
import { generateText } from "ai";
import { createModelProvider } from "@closeclaw/ai-agent";
import { readConfig } from "../config/config-reader.js";
import { writeConfig } from "../config/config-writer.js";
import {
  executeAgentConfigure,
  type AgentConfigureDeps,
} from "./agent-configure-run.js";

export type { AgentConfigureDeps };

export async function runAgentConfigure(
  deps: AgentConfigureDeps,
): Promise<void> {
  try {
    await executeAgentConfigure(deps);
  } catch (e) {
    if (e instanceof ExitPromptError) process.exit(130);
    throw e;
  }
}

export function createAgentConfigureDeps(): AgentConfigureDeps {
  return {
    configPath: join(homedir(), ".closeclaw", "config.json"),
    readConfig,
    writeConfig,
    select,
    input,
    password,
    confirm,
    checkbox,
    generateText,
    createModelProvider,
  };
}
