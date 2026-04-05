import type { BotAdapter } from "@closeclaw/bot-adapters";
import {
  BotPlatform,
  DmPolicy,
  type BotIntegration,
  type Configuration,
  type GatewayConfig,
} from "@closeclaw/shared-types";
import type { ConfigState } from "../config/config-detector.js";
import type { GatewayStartDeps } from "./gateway-start.js";
import type { OnboardDeps } from "./onboard.js";

export async function resolveConfirmProceed(
  deps: OnboardDeps,
): Promise<boolean> {
  const fn = deps.confirmProceed;
  if (!fn) return true;
  return fn();
}

export async function runConfigureFlow(
  deps: OnboardDeps,
  existing: Configuration | null,
  state: ConfigState,
): Promise<void> {
  const platform = await deps.selectPlatform(state.availablePlatforms);
  const help = deps.getInstructions(platform);
  if (help.length > 0) {
    console.log(help);
  }
  if (!(await resolveConfirmProceed(deps))) {
    console.log("No problem! Run 'closeclaw onboard' when you're ready.");
    return;
  }
  const token = await deps.inputBotToken(platform);
  const dmPolicy = await deps.selectDmPolicy();
  const allowed = await resolveAllowlist(deps, dmPolicy);
  if (!validateAllowlist(dmPolicy, allowed)) return;
  const integration = buildIntegration(platform, token, dmPolicy, allowed);
  await persistAndVerify(deps, existing, platform, integration, token);
}

export function validateAllowlist(
  dmPolicy: DmPolicy,
  allowed: string[],
): boolean {
  if (dmPolicy !== DmPolicy.ALLOWLIST) return true;
  if (allowed.length > 0) return true;
  console.error("Allowlist requires at least one user ID.");
  return false;
}

export async function resolveAllowlist(
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

export function buildIntegration(
  platform: BotPlatform,
  token: string,
  dmPolicy: DmPolicy,
  allowedSenders: string[],
): BotIntegration {
  const createdAt = new Date().toISOString();
  const common = { platform, botToken: token, enabled: true, createdAt };
  return dmPolicy === DmPolicy.ALLOWLIST
    ? { ...common, dmPolicy, allowedSenders }
    : { ...common, dmPolicy };
}

async function healthCheckAndWrite(
  deps: OnboardDeps,
  adapter: BotAdapter,
  config: Configuration,
): Promise<void> {
  const health = await deps.checkHealth([adapter]);
  if (health.status !== "healthy") {
    throw new Error("Onboarding health check failed");
  }
  deps.writeConfig(deps.configPath, config);
}

export async function persistAndVerify(
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
    await healthCheckAndWrite(deps, adapter, config);
  } finally {
    await safeDisconnect(adapter);
  }
  await promptAndStartGateway(deps);
}

export function pickGateway(
  deps: OnboardDeps,
  existing: Configuration | null,
): GatewayConfig {
  return existing?.gateway ?? deps.generateGatewayConfig();
}

export function mergeChannels(
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

export function assembleConfig(
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

export async function safeDisconnect(adapter: BotAdapter): Promise<void> {
  try {
    await adapter.disconnect();
  } catch {
    void 0;
  }
}

export async function promptAndStartGateway(deps: OnboardDeps): Promise<void> {
  const ask = deps.confirmStartGateway;
  if (!ask) return;
  if (!(await ask())) return;
  const mod = await import("./gateway-start.js");
  const gwDeps: GatewayStartDeps = {
    ...mod.createGatewayStartDeps(),
    configPath: deps.configPath,
  };
  const run = deps.runGatewayStart ?? mod.runGatewayStart;
  await run(gwDeps);
}

export async function promptAllowlistSenders(): Promise<string[]> {
  const { input } = await import("@inquirer/prompts");
  for (;;) {
    const raw = await input({
      message: "Comma-separated allowed user IDs",
      validate: (v) => (v.trim().length > 0 ? true : "Enter at least one ID"),
    });
    const ids = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length > 0) return ids;
  }
}

export async function defaultConfirmProceed(): Promise<boolean> {
  const { confirm } = await import("@inquirer/prompts");
  return confirm({
    message: "Ready to proceed with token entry?",
    default: true,
  });
}

export async function defaultConfirmStartGateway(): Promise<boolean> {
  const { confirm } = await import("@inquirer/prompts");
  return confirm({
    message: "Start the gateway now?",
    default: false,
  });
}
