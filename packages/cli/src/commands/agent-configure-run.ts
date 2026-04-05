import type {
  Configuration,
  AgentConfig,
  ToolConfig,
  ToolName,
  AiProvider,
} from "@closeclaw/shared-types";
import {
  AI_PROVIDERS,
  DEFAULT_TOOL_CONFIG,
  DEFAULT_MAX_CONTEXT_TOKENS,
  DEFAULT_SYSTEM_PROMPT,
  requiresApiKey,
  requiresBaseUrl,
  TOOL_NAMES,
} from "@closeclaw/shared-types";
import { PROVIDER_INFO } from "@closeclaw/ai-agent";
import type { generateText as GenerateTextFn } from "ai";
import {
  formatErr,
  logCurrentAgent,
  persistAgent,
  readExistingConfig,
} from "./agent-configure-support.js";

export interface AgentConfigureDeps {
  configPath: string;
  readConfig: (path: string) => Configuration | null;
  writeConfig: (path: string, config: Configuration) => void;
  select: <T extends string = string>(opts: {
    message: string;
    choices: { name: string; value: T }[];
  }) => Promise<T>;
  input: (opts: {
    message: string;
    default?: string;
    validate?: (v: string) => true | string;
  }) => Promise<string>;
  password: (opts: { message: string }) => Promise<string>;
  confirm: (opts: { message: string; default?: boolean }) => Promise<boolean>;
  checkbox: (opts: {
    message: string;
    choices: { name: string; value: ToolName }[];
  }) => Promise<ToolName[]>;
  generateText: typeof GenerateTextFn;
  createModelProvider: typeof import("@closeclaw/ai-agent").createModelProvider;
}

async function shouldReconfigure(
  deps: AgentConfigureDeps,
  existing: Configuration,
): Promise<boolean> {
  if (!existing.agent) return true;
  logCurrentAgent(existing.agent);
  return deps.confirm({ message: "Reconfigure the agent?", default: false });
}

async function pickProvider(deps: AgentConfigureDeps): Promise<AiProvider> {
  const choices = AI_PROVIDERS.map((value) => ({
    name: `${PROVIDER_INFO[value].name} — ${PROVIDER_INFO[value].description}`,
    value,
  }));
  return deps.select({ message: "AI provider", choices });
}

const CUSTOM_MODEL_SENTINEL = "__custom__";

async function promptModel(
  deps: AgentConfigureDeps,
  provider: AiProvider,
): Promise<string> {
  const models = PROVIDER_INFO[provider].exampleModels;
  if (models.length === 0) return promptCustomModelName(deps);
  const choices = [
    ...models.map((m) => ({ name: m, value: m })),
    { name: "Custom (enter manually)", value: CUSTOM_MODEL_SENTINEL },
  ];
  const picked = await deps.select({ message: "Model", choices });
  if (picked === CUSTOM_MODEL_SENTINEL) return promptCustomModelName(deps);
  return picked;
}

async function promptCustomModelName(
  deps: AgentConfigureDeps,
): Promise<string> {
  return deps.input({
    message: "Model name",
    validate: (v) => (v.trim().length > 0 ? true : "Required"),
  });
}

async function promptApiKeyMaybe(
  deps: AgentConfigureDeps,
  provider: AiProvider,
): Promise<string | undefined> {
  if (!requiresApiKey(provider)) return undefined;
  return deps.password({ message: "API key" });
}

async function promptBaseUrlMaybe(
  deps: AgentConfigureDeps,
  provider: AiProvider,
): Promise<string | undefined> {
  if (!requiresBaseUrl(provider)) return undefined;
  const def = PROVIDER_INFO[provider].defaultBaseUrl ?? "";
  return deps.input({
    message: "Base URL",
    default: def,
    validate: (v) => (v.trim().length > 0 ? true : "Required"),
  });
}

async function stripShellUnlessConfirmed(
  deps: AgentConfigureDeps,
  allowed: ToolName[],
): Promise<ToolName[]> {
  if (!allowed.includes("shell_execute")) return allowed;
  const ok = await deps.confirm({
    message:
      "shell_execute runs commands on this machine. Do you accept this risk?",
    default: false,
  });
  if (ok) return allowed;
  return allowed.filter((t) => t !== "shell_execute");
}

async function collectTools(deps: AgentConfigureDeps): Promise<ToolConfig> {
  const enabled = await deps.confirm({
    message: "Enable tool calling?",
    default: false,
  });
  if (!enabled) return { ...DEFAULT_TOOL_CONFIG };
  const picked = await deps.checkbox({
    message: "Tools to allow",
    choices: TOOL_NAMES.map((value) => ({ name: value, value })),
  });
  const allowed = await stripShellUnlessConfirmed(deps, picked);
  return {
    ...DEFAULT_TOOL_CONFIG,
    enabled: true,
    allowedTools: allowed,
  };
}

function assembleAgent(
  provider: AiProvider,
  model: string,
  apiKey: string | undefined,
  baseUrl: string | undefined,
  tools: ToolConfig,
): AgentConfig {
  return {
    provider,
    model,
    ...(apiKey !== undefined && apiKey !== "" ? { apiKey } : {}),
    ...(baseUrl !== undefined && baseUrl !== "" ? { baseUrl } : {}),
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    maxContextTokens: DEFAULT_MAX_CONTEXT_TOKENS,
    tools,
  };
}

async function validateUntilDoneOrExit(
  deps: AgentConfigureDeps,
  agent: AgentConfig,
): Promise<void> {
  for (;;) {
    try {
      await deps.generateText({
        model: deps.createModelProvider(agent),
        prompt: "Reply with exactly: OK",
      });
      return;
    } catch (e) {
      console.error(formatErr(e));
      const retry = await deps.confirm({
        message: "Retry connection test?",
        default: true,
      });
      if (!retry) process.exit(1);
    }
  }
}

export async function executeAgentConfigure(
  deps: AgentConfigureDeps,
): Promise<void> {
  const existing = readExistingConfig(deps.readConfig, deps.configPath);
  if (!existing) return;
  if (!(await shouldReconfigure(deps, existing))) return;
  const provider = await pickProvider(deps);
  const model = await promptModel(deps, provider);
  const apiKey = await promptApiKeyMaybe(deps, provider);
  const baseUrl = await promptBaseUrlMaybe(deps, provider);
  const tools = await collectTools(deps);
  const agent = assembleAgent(provider, model, apiKey, baseUrl, tools);
  await validateUntilDoneOrExit(deps, agent);
  persistAgent(deps.writeConfig, deps.configPath, existing, agent);
  console.log("Agent configuration saved.");
}
