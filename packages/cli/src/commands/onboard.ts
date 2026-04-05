import { unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { ExitPromptError } from "@inquirer/core";
import type { BotAdapter } from "@closeclaw/bot-adapters";
import { checkHealth, generateGatewayConfig } from "@closeclaw/gateway";
import type { HealthCheckResult } from "@closeclaw/gateway";
import {
  BotPlatform,
  DmPolicy,
  type Configuration,
  type GatewayConfig,
} from "@closeclaw/shared-types";
import { ConfigReadError, readConfig } from "../config/config-reader.js";
import { writeConfig } from "../config/config-writer.js";
import {
  detectConfigState,
  type ConfigState,
} from "../config/config-detector.js";
import { getDiscordInstructions } from "../instructions/discord-setup.js";
import { getTelegramInstructions } from "../instructions/telegram-setup.js";
import type { OnboardExistingAction } from "../prompts/onboard-action-select.js";
import type { GatewayStartDeps } from "./gateway-start.js";
import {
  defaultConfirmProceed,
  defaultConfirmStartGateway,
  promptAllowlistSenders,
  runConfigureFlow,
} from "./onboard-configure.js";
import {
  runAllConfiguredChoice,
  runExistingPartialChoice,
} from "./onboard-reset.js";

const require = createRequire(import.meta.url);

export interface OnboardDeps {
  configPath: string;
  readConfig: (path: string) => Configuration | null;
  detectConfig: (config: Configuration | null) => ConfigState;
  writeConfig: (path: string, config: Configuration) => void;
  selectAction: () => Promise<OnboardExistingAction>;
  selectPlatform: (platforms: BotPlatform[]) => Promise<BotPlatform>;
  selectResetScope?: () => Promise<"all" | "specific">;
  selectPlatformToReset?: (platforms: BotPlatform[]) => Promise<BotPlatform>;
  confirmReset?: (message: string) => Promise<boolean>;
  getInstructions: (platform: BotPlatform) => string;
  confirmProceed?: () => Promise<boolean>;
  confirmResetMalformedConfig?: () => Promise<boolean>;
  unlinkConfig?: (path: string) => void;
  inputBotToken: (platform: BotPlatform) => Promise<string>;
  selectDmPolicy: () => Promise<DmPolicy>;
  inputAllowlistSenders?: () => Promise<string[]>;
  createAdapter: (platform: BotPlatform, token: string) => BotAdapter;
  checkHealth: (adapters: BotAdapter[]) => Promise<HealthCheckResult>;
  generateGatewayConfig: () => GatewayConfig;
  confirmStartGateway?: () => Promise<boolean>;
  runGatewayStart?: (deps: GatewayStartDeps) => Promise<void>;
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

async function confirmResetAfterMalformed(deps: OnboardDeps): Promise<boolean> {
  if (deps.confirmResetMalformedConfig) {
    return deps.confirmResetMalformedConfig();
  }
  const { confirm } = await import("@inquirer/prompts");
  return confirm({ message: "Reset configuration?", default: false });
}

function exitWithCodeOne(): never {
  process.exit(1);
}

function removeConfigFile(deps: OnboardDeps): void {
  const fn = deps.unlinkConfig ?? ((p: string) => unlinkSync(p));
  fn(deps.configPath);
}

async function loadConfigOrOfferReset(
  deps: OnboardDeps,
): Promise<Configuration | null> {
  try {
    return deps.readConfig(deps.configPath);
  } catch (e: unknown) {
    if (!(e instanceof ConfigReadError)) throw e;
    console.error(e.message);
    const ok = await confirmResetAfterMalformed(deps);
    if (!ok) exitWithCodeOne();
    removeConfigFile(deps);
    return loadConfigOrOfferReset(deps);
  }
}

async function executeOnboard(deps: OnboardDeps): Promise<void> {
  const existing = await loadConfigOrOfferReset(deps);
  const state = deps.detectConfig(existing);
  if (!state.exists) {
    await runConfigureFlow(deps, existing, state);
    return;
  }
  if (state.allPlatformsConfigured) {
    await runAllConfiguredChoice(deps, existing, state);
    return;
  }
  await runExistingPartialChoice(deps, existing, state);
}

export function defaultConfigPath(): string {
  return join(homedir(), ".closeclaw", "config.json");
}

export function instructionsForPlatform(platform: BotPlatform): string {
  return platform === BotPlatform.TELEGRAM
    ? getTelegramInstructions()
    : getDiscordInstructions();
}

export function createAdapterFromPackage(
  platform: BotPlatform,
  token: string,
): BotAdapter {
  const mod =
    require("@closeclaw/bot-adapters") as typeof import("@closeclaw/bot-adapters");
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
    selectResetScope: () =>
      import("../prompts/reset-scope-select.js").then((m) =>
        m.selectResetScope(),
      ),
    selectPlatformToReset: (platforms) =>
      import("../prompts/reset-platform-select.js").then((m) =>
        m.selectPlatformToReset(platforms),
      ),
    confirmReset: (message) =>
      import("../prompts/reset-confirm.js").then((m) =>
        m.confirmReset(message),
      ),
    selectPlatform: (platforms) =>
      import("../prompts/platform-select.js").then((m) =>
        m.selectPlatform(platforms),
      ),
    getInstructions: instructionsForPlatform,
    confirmProceed: defaultConfirmProceed,
    inputBotToken: (platform) =>
      import("../prompts/token-input.js").then((m) =>
        m.inputBotToken(platform),
      ),
    selectDmPolicy: () =>
      import("../prompts/dm-policy-select.js").then((m) => m.selectDmPolicy()),
    inputAllowlistSenders: promptAllowlistSenders,
    createAdapter: createAdapterFromPackage,
    checkHealth,
    generateGatewayConfig,
    confirmStartGateway: defaultConfirmStartGateway,
  };
}
