import { ExitPromptError } from "@inquirer/core";
import type { AgentConfig, Configuration } from "@closeclaw/shared-types";
import { homedir } from "node:os";
import { join } from "node:path";
import { input, select } from "@inquirer/prompts";
import { ConfigReadError, readConfig } from "../config/config-reader.js";
import { writeConfig } from "../config/config-writer.js";

const CHOICE_EDIT = "edit";
const CHOICE_KEEP = "keep";

export interface AgentSystemPromptDeps {
  configPath: string;
  readConfig: (path: string) => Configuration | null;
  writeConfig: (path: string, config: Configuration) => void;
  input: (opts: { message: string }) => Promise<string>;
  select: (opts: {
    message: string;
    choices: ReadonlyArray<{ name: string; value: string }>;
  }) => Promise<string>;
  log: (...args: unknown[]) => void;
}

export async function runAgentSystemPrompt(
  deps: AgentSystemPromptDeps,
): Promise<void> {
  try {
    await executeAgentSystemPrompt(deps);
  } catch (e: unknown) {
    if (e instanceof ExitPromptError) {
      process.exit(130);
    }
    throw e;
  }
}

async function executeAgentSystemPrompt(
  deps: AgentSystemPromptDeps,
): Promise<void> {
  const config = loadConfiguration(deps);
  if (config === false) return;
  if (!isAgentConfigured(config)) {
    deps.log("No AI agent configured. Run 'closeclaw agent configure' first.");
    return;
  }
  await runPromptFlow(deps, config);
}

function loadConfiguration(
  deps: AgentSystemPromptDeps,
): Configuration | null | false {
  try {
    return deps.readConfig(deps.configPath);
  } catch (e: unknown) {
    if (!(e instanceof ConfigReadError)) throw e;
    console.error(e.message);
    return false;
  }
}

function isAgentConfigured(
  config: Configuration | null,
): config is Configuration & { agent: AgentConfig } {
  return config !== null && config.agent !== undefined;
}

async function runPromptFlow(
  deps: AgentSystemPromptDeps,
  config: Configuration & { agent: AgentConfig },
): Promise<void> {
  deps.log(`Current system prompt: "${config.agent.systemPrompt}"`);
  const choice = await deps.select({
    message: "What would you like to do?",
    choices: [
      { name: "Edit system prompt", value: CHOICE_EDIT },
      { name: "Keep current prompt", value: CHOICE_KEEP },
    ],
  });
  if (choice === CHOICE_KEEP) return;
  await saveNewSystemPrompt(deps, config);
}

async function saveNewSystemPrompt(
  deps: AgentSystemPromptDeps,
  config: Configuration & { agent: AgentConfig },
): Promise<void> {
  const newPrompt = await deps.input({ message: "Enter new system prompt:" });
  const next: Configuration = {
    ...config,
    lastModified: new Date().toISOString(),
    agent: { ...config.agent, systemPrompt: newPrompt },
  };
  deps.writeConfig(deps.configPath, next);
  deps.log("System prompt updated.");
}

function defaultConfigPath(): string {
  return join(homedir(), ".closeclaw", "config.json");
}

export function createAgentSystemPromptDeps(): AgentSystemPromptDeps {
  return {
    configPath: defaultConfigPath(),
    readConfig,
    writeConfig,
    input,
    select,
    log: (...args: unknown[]) => {
      console.log(...args);
    },
  };
}
