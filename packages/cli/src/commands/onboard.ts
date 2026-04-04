import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { ExitPromptError } from "@inquirer/core";
import { checkHealth, generateGatewayConfig } from "@closeclaw/gateway";
import type { HealthCheckResult } from "@closeclaw/gateway";
import {
  BotPlatform,
  DmPolicy,
  type BotIntegration,
  type Configuration,
  type GatewayConfig,
} from "@closeclaw/shared-types";
import type { BotAdapter } from "@closeclaw/bot-adapters";
import { readConfig } from "../config/config-reader.js";
import { writeConfig } from "../config/config-writer.js";
import {
  detectConfigState,
  type ConfigState,
} from "../config/config-detector.js";
import { getDiscordInstructions } from "../instructions/discord-setup.js";
import { getTelegramInstructions } from "../instructions/telegram-setup.js";
import type { OnboardExistingAction } from "../prompts/onboard-action-select.js";

const require = createRequire(import.meta.url);

export interface OnboardDeps {
  configPath: string;
  readConfig: (path: string) => Configuration | null;
  detectConfig: (config: Configuration | null) => ConfigState;
  writeConfig: (path: string, config: Configuration) => void;
  selectAction: () => Promise<OnboardExistingAction>;
  selectPlatform: (platforms: BotPlatform[]) => Promise<BotPlatform>;
  getInstructions: (platform: BotPlatform) => string;
  inputBotToken: (platform: BotPlatform) => Promise<string>;
  selectDmPolicy: () => Promise<DmPolicy>;
  inputAllowlistSenders?: () => Promise<string[]>;
  createAdapter: (platform: BotPlatform, token: string) => BotAdapter;
  checkHealth: (adapters: BotAdapter[]) => Promise<HealthCheckResult>;
  generateGatewayConfig: () => GatewayConfig;
}

export async function runOnboard(deps: OnboardDeps): Promise<void> {
  try {
    await executeOnboard(deps);
  } catch (e: unknown) {
    if (e instanceof ExitPromptError) {
      process.exit(130);
    }
    throw e;
  }
}

async function executeOnboard(deps: OnboardDeps): Promise<void> {
  const existing = deps.readConfig(deps.configPath);
  const state = deps.detectConfig(existing);
  if (!state.exists) {
    await runConfigureFlow(deps, existing, state);
    return;
  }
  if (state.allPlatformsConfigured) {
    logAllPlatformsConfigured();
    return;
  }
  await runExistingPartialChoice(deps, existing, state);
}

function logAllPlatformsConfigured(): void {
  console.log("All platforms are already configured.");
  console.log(
    'To start over, choose "Reset configuration" when running closeclaw onboard.',
  );
}

async function runExistingPartialChoice(
  deps: OnboardDeps,
  existing: Configuration | null,
  state: ConfigState,
): Promise<void> {
  const action = await deps.selectAction();
  if (action === "reset-configuration") {
    console.log("Reset configuration is not implemented yet.");
    return;
  }
  await runConfigureFlow(deps, existing, state);
}

async function runConfigureFlow(
  deps: OnboardDeps,
  existing: Configuration | null,
  state: ConfigState,
): Promise<void> {
  const platform = await deps.selectPlatform(state.availablePlatforms);
  const help = deps.getInstructions(platform);
  if (help.length > 0) {
    console.log(help);
  }
  const token = await deps.inputBotToken(platform);
  const dmPolicy = await deps.selectDmPolicy();
  const allowed = await resolveAllowlist(deps, dmPolicy);
  if (!validateAllowlist(dmPolicy, allowed)) return;
  const integration = buildIntegration(platform, token, dmPolicy, allowed);
  await persistAndVerify(deps, existing, platform, integration, token);
}

function validateAllowlist(dmPolicy: DmPolicy, allowed: string[]): boolean {
  if (dmPolicy !== DmPolicy.ALLOWLIST) return true;
  if (allowed.length > 0) return true;
  console.error("Allowlist requires at least one user ID.");
  return false;
}

async function resolveAllowlist(
  deps: OnboardDeps,
  dmPolicy: DmPolicy,
): Promise<string[]> {
  if (dmPolicy !== DmPolicy.ALLOWLIST) return [];
  const fn = deps.inputAllowlistSenders;
  if (!fn) {
    throw new Error("inputAllowlistSenders required for allowlist policy");
  }
  return fn();
}

function buildIntegration(
  platform: BotPlatform,
  token: string,
  dmPolicy: DmPolicy,
  allowedSenders: string[],
): BotIntegration {
  const createdAt = new Date().toISOString();
  if (dmPolicy === DmPolicy.ALLOWLIST) {
    return {
      platform,
      botToken: token,
      enabled: true,
      dmPolicy,
      allowedSenders,
      createdAt,
    };
  }
  return {
    platform,
    botToken: token,
    enabled: true,
    dmPolicy,
    createdAt,
  };
}

async function persistAndVerify(
  deps: OnboardDeps,
  existing: Configuration | null,
  platform: BotPlatform,
  integration: BotIntegration,
  token: string,
): Promise<void> {
  const gateway = pickGateway(deps, existing);
  const channels = mergeChannels(existing, platform, integration);
  const config = assembleConfig(channels, gateway);
  const adapter = deps.createAdapter(platform, token);
  try {
    const health = await deps.checkHealth([adapter]);
    if (health.status !== "healthy") {
      throw new Error("Onboarding health check failed");
    }
    deps.writeConfig(deps.configPath, config);
  } finally {
    await safeDisconnect(adapter);
  }
}

function pickGateway(
  deps: OnboardDeps,
  existing: Configuration | null,
): GatewayConfig {
  return existing?.gateway ?? deps.generateGatewayConfig();
}

function mergeChannels(
  existing: Configuration | null,
  platform: BotPlatform,
  integration: BotIntegration,
): Configuration["channels"] {
  const prev = existing?.channels;
  if (!prev) {
    return { [platform]: integration };
  }
  return { ...prev, [platform]: integration };
}

function assembleConfig(
  channels: Configuration["channels"],
  gateway: GatewayConfig,
): Configuration {
  return {
    version: "0.1.0",
    lastModified: new Date().toISOString(),
    channels,
    gateway,
  };
}

async function safeDisconnect(adapter: BotAdapter): Promise<void> {
  try {
    await adapter.disconnect();
  } catch {
    void 0;
  }
}

async function promptAllowlistSenders(): Promise<string[]> {
  const { input } = await import("@inquirer/prompts");
  for (;;) {
    const raw = await input({
      message: "Comma-separated allowed user IDs",
      validate: (v) =>
        v.trim().length > 0 ? true : "Enter at least one ID",
    });
    const ids = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length > 0) return ids;
  }
}

function defaultConfigPath(): string {
  return join(homedir(), ".closeclaw", "config.json");
}

function instructionsForPlatform(platform: BotPlatform): string {
  return platform === BotPlatform.TELEGRAM
    ? getTelegramInstructions()
    : getDiscordInstructions();
}

function createAdapterFromPackage(
  platform: BotPlatform,
  token: string,
): BotAdapter {
  const mod = require("@closeclaw/bot-adapters") as typeof import("@closeclaw/bot-adapters");
  if (platform === BotPlatform.TELEGRAM) {
    return new mod.TelegramAdapter({ token });
  }
  return new mod.DiscordAdapter({ token });
}

export function createOnboardDeps(): OnboardDeps {
  return {
    configPath: defaultConfigPath(),
    readConfig,
    writeConfig,
    detectConfig: detectConfigState,
    selectAction: () =>
      import("../prompts/onboard-action-select.js").then((m) =>
        m.selectOnboardExistingAction(),
      ),
    selectPlatform: (platforms) =>
      import("../prompts/platform-select.js").then((m) =>
        m.selectPlatform(platforms),
      ),
    getInstructions: instructionsForPlatform,
    inputBotToken: (platform) =>
      import("../prompts/token-input.js").then((m) =>
        m.inputBotToken(platform),
      ),
    selectDmPolicy: () =>
      import("../prompts/dm-policy-select.js").then((m) =>
        m.selectDmPolicy(),
      ),
    inputAllowlistSenders: promptAllowlistSenders,
    createAdapter: createAdapterFromPackage,
    checkHealth,
    generateGatewayConfig,
  };
}
