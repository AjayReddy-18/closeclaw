import { homedir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import type { Configuration } from "@closeclaw/shared-types";
import { readConfig } from "../config/config-reader.js";
import { writeConfig } from "../config/config-writer.js";
import { runHeartbeatConfigure } from "./heartbeat-configure.js";
import { runHeartbeatStatus } from "./heartbeat-status.js";

export interface HeartbeatDeps {
  configPath: string;
  readConfig: (path: string) => Configuration | null;
  writeConfig: (path: string, config: Configuration) => void;
}

export function createHeartbeatDeps(): HeartbeatDeps {
  return {
    configPath: join(homedir(), ".closeclaw", "config.json"),
    readConfig,
    writeConfig,
  };
}

export function registerHeartbeatCommands(
  program: Command,
  deps: HeartbeatDeps,
): void {
  const hb = program
    .command("heartbeat")
    .description("Manage heartbeat settings");

  hb.command("configure")
    .description("Configure the heartbeat schedule")
    .action(async () => {
      await runHeartbeatConfigure({
        readConfig: () => deps.readConfig(deps.configPath),
        writeConfig: (cfg) => deps.writeConfig(deps.configPath, cfg),
      });
    });

  hb.command("status")
    .description("Show current heartbeat configuration")
    .action(() => {
      runHeartbeatStatus({
        readConfig: () => deps.readConfig(deps.configPath),
      });
    });
}
