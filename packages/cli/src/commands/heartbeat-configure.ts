import { input, confirm, select } from "@inquirer/prompts";
import type { HeartbeatConfig, HeartbeatTarget, Configuration } from "@closeclaw/shared-types";
import { DEFAULT_HEARTBEAT_INTERVAL, DEFAULT_HEARTBEAT_TARGET } from "@closeclaw/shared-types";

export interface HeartbeatConfigureDeps {
  readConfig: () => Configuration | null;
  writeConfig: (config: Configuration) => void;
  prompt?: typeof input;
  confirmPrompt?: typeof confirm;
  selectPrompt?: typeof select;
}

async function promptInterval(deps: HeartbeatConfigureDeps): Promise<string> {
  const ask = deps.prompt ?? input;
  return await ask({
    message: "Heartbeat interval (e.g. 30m, 1h, 2h):",
    default: DEFAULT_HEARTBEAT_INTERVAL,
  });
}

async function promptActiveHours(
  deps: HeartbeatConfigureDeps,
): Promise<{ start: string; end: string } | undefined> {
  const ask = deps.confirmPrompt ?? confirm;
  const useHours = await ask({ message: "Set active hours?", default: false });
  if (!useHours) return undefined;
  const promptFn = deps.prompt ?? input;
  const start = await promptFn({ message: "Start time (HH:MM):", default: "09:00" });
  const end = await promptFn({ message: "End time (HH:MM):", default: "22:00" });
  return { start, end };
}

async function promptTarget(deps: HeartbeatConfigureDeps): Promise<HeartbeatTarget> {
  const ask = deps.selectPrompt ?? select;
  return (await ask({
    message: "Delivery target:",
    choices: [
      { name: "Last sender (recommended)", value: "last" },
      { name: "None (silent)", value: "none" },
    ],
    default: DEFAULT_HEARTBEAT_TARGET,
  })) as HeartbeatTarget;
}

export async function runHeartbeatConfigure(deps: HeartbeatConfigureDeps): Promise<void> {
  const config = deps.readConfig();
  if (!config) {
    console.error("Configuration not found. Run closeclaw onboard first.");
    return;
  }
  const every = await promptInterval(deps);
  const activeHours = await promptActiveHours(deps);
  const target = await promptTarget(deps);
  const heartbeat: HeartbeatConfig = { enabled: true, every, target };
  if (activeHours) heartbeat.activeHours = activeHours;
  config.heartbeat = heartbeat;
  deps.writeConfig(config);
  console.log("Heartbeat configured.");
}
