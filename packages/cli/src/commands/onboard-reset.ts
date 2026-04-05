import type { BotPlatform, Configuration } from "@closeclaw/shared-types";
import type { ConfigState } from "../config/config-detector.js";
import type { OnboardDeps } from "./onboard.js";
import {
  assembleConfig,
  pickGateway,
  runConfigureFlow,
} from "./onboard-configure.js";

export async function runAllConfiguredChoice(
  deps: OnboardDeps,
  existing: Configuration | null,
  _state: ConfigState,
): Promise<void> {
  const action = await deps.selectAction();
  if (action === "reset-configuration") {
    await runResetConfiguration(deps, existing);
    return;
  }
  logAllPlatformsConfigured();
}

export function logAllPlatformsConfigured(): void {
  console.log("All platforms are already configured.");
  console.log(
    'To start over, choose "Reset configuration" when running closeclaw onboard.',
  );
}

export async function runExistingPartialChoice(
  deps: OnboardDeps,
  existing: Configuration | null,
  state: ConfigState,
): Promise<void> {
  const action = await deps.selectAction();
  if (action === "reset-configuration") {
    await runResetConfiguration(deps, existing);
    return;
  }
  await runConfigureFlow(deps, existing, state);
}

export async function runResetConfiguration(
  deps: OnboardDeps,
  existing: Configuration | null,
): Promise<void> {
  if (existing === null) {
    return;
  }
  const scope = await loadResetScope(deps);
  const platform =
    scope === "specific"
      ? await loadPlatformToReset(deps, existing)
      : undefined;
  if (!(await loadResetConfirmed(deps, scope, platform))) {
    return;
  }
  await persistReset(deps, existing, scope, platform);
  await continueConfigureAfterReset(deps);
}

export async function loadResetScope(
  deps: OnboardDeps,
): Promise<"all" | "specific"> {
  if (deps.selectResetScope) {
    return deps.selectResetScope();
  }
  const m = await import("../prompts/reset-scope-select.js");
  return m.selectResetScope();
}

export async function loadPlatformToReset(
  deps: OnboardDeps,
  existing: Configuration,
): Promise<BotPlatform> {
  const keys = Object.keys(existing.channels) as BotPlatform[];
  if (deps.selectPlatformToReset) {
    return deps.selectPlatformToReset(keys);
  }
  const m = await import("../prompts/reset-platform-select.js");
  return m.selectPlatformToReset(keys);
}

export function resetWarningMessage(
  scope: "all" | "specific",
  platform: BotPlatform | undefined,
): string {
  if (scope === "all") {
    return "This will remove all bot integrations. Are you sure?";
  }
  const label = platform ?? "selected platform";
  return `This will remove the ${label} integration. Are you sure?`;
}

export async function loadResetConfirmed(
  deps: OnboardDeps,
  scope: "all" | "specific",
  platform: BotPlatform | undefined,
): Promise<boolean> {
  const msg = resetWarningMessage(scope, platform);
  if (deps.confirmReset) {
    return deps.confirmReset(msg);
  }
  const m = await import("../prompts/reset-confirm.js");
  return m.confirmReset(msg);
}

export function channelsWithoutPlatform(
  channels: Configuration["channels"],
  platform: BotPlatform,
): Configuration["channels"] {
  const next: Configuration["channels"] = { ...channels };
  delete next[platform];
  return next;
}

export function buildResetChannels(
  scope: "all" | "specific",
  existing: Configuration,
  platform: BotPlatform | undefined,
): Configuration["channels"] {
  if (scope === "all") {
    return {};
  }
  if (platform === undefined) {
    return existing.channels;
  }
  return channelsWithoutPlatform(existing.channels, platform);
}

export async function persistReset(
  deps: OnboardDeps,
  existing: Configuration,
  scope: "all" | "specific",
  platform: BotPlatform | undefined,
): Promise<void> {
  const gateway = pickGateway(deps, existing);
  const channels = buildResetChannels(scope, existing, platform);
  deps.writeConfig(deps.configPath, assembleConfig(channels, gateway));
}

export async function continueConfigureAfterReset(
  deps: OnboardDeps,
): Promise<void> {
  const fresh = deps.readConfig(deps.configPath);
  const nextState = deps.detectConfig(fresh);
  await runConfigureFlow(deps, fresh, nextState);
}
