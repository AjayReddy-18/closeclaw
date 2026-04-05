import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import type { BotAdapter } from "@closeclaw/bot-adapters";
import type { createPersistentConversationStore } from "@closeclaw/ai-agent";
import type { createMessageProcessor } from "@closeclaw/ai-agent";
import type { HeartbeatRunner } from "@closeclaw/ai-agent";
import { createGatewayServer as createGatewayServerImpl } from "@closeclaw/gateway";
import {
  BotPlatform,
  DmPolicy,
  type Configuration,
  isValidAgentConfig,
} from "@closeclaw/shared-types";
import { ConfigReadError, readConfig } from "../config/config-reader.js";
import { assembleAgent } from "./agent-assembly.js";
import { setupHeartbeat } from "./heartbeat-setup.js";

const require = createRequire(import.meta.url);

export interface GatewayStartDeps {
  configPath: string;
  pairingStorePath: string;
  readConfig: (path: string) => Configuration | null;
  createAdapter: (platform: BotPlatform, token: string) => BotAdapter;
  createGatewayServer: typeof createGatewayServerImpl;
  waitForShutdown?: () => Promise<void>;
}

function createAdapterFromPackage(
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

function listEnabledChannelEntries(
  channels: Configuration["channels"],
): { platform: BotPlatform; token: string }[] {
  const out: { platform: BotPlatform; token: string }[] = [];
  for (const platform of Object.keys(channels) as BotPlatform[]) {
    const ch = channels[platform];
    if (ch?.enabled !== true) continue;
    out.push({ platform, token: ch.botToken });
  }
  return out;
}

function dmSettingsFromConfig(
  config: Configuration,
  platform: BotPlatform,
): { dmPolicy: DmPolicy; allowedSenders?: string[] } {
  const ch = config.channels[platform];
  if (!ch) return { dmPolicy: DmPolicy.OPEN };
  if (ch.allowedSenders === undefined) {
    return { dmPolicy: ch.dmPolicy };
  }
  return { dmPolicy: ch.dmPolicy, allowedSenders: ch.allowedSenders };
}

function buildAdapters(
  config: Configuration,
  createAdapter: (platform: BotPlatform, token: string) => BotAdapter,
): BotAdapter[] {
  return listEnabledChannelEntries(config.channels).map((e) =>
    createAdapter(e.platform, e.token),
  );
}

function readGatewayConfig(deps: GatewayStartDeps): Configuration | null {
  try {
    const c = deps.readConfig(deps.configPath);
    if (c === null) {
      console.error(
        `Configuration not found: ${deps.configPath}. Run closeclaw onboard to create it.`,
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

async function connectAll(adapters: BotAdapter[]): Promise<void> {
  await Promise.all(adapters.map((a) => a.connect()));
}

async function disconnectAll(adapters: BotAdapter[]): Promise<void> {
  await Promise.all(
    adapters.map(async (a) => {
      try {
        await a.disconnect();
      } catch {
        void 0;
      }
    }),
  );
}

function waitForSigint(): Promise<void> {
  return new Promise((resolve) => {
    const done = (): void => {
      process.off("SIGINT", done);
      process.off("SIGTERM", done);
      resolve();
    };
    process.on("SIGINT", done);
    process.on("SIGTERM", done);
  });
}

export async function runGatewayStart(deps: GatewayStartDeps): Promise<void> {
  const config = readGatewayConfig(deps);
  if (!config) return;
  const adapters = buildAdapters(config, deps.createAdapter);
  let pruneInterval: ReturnType<typeof setInterval> | undefined;
  let store: ReturnType<typeof createPersistentConversationStore> | undefined;
  let processor: ReturnType<typeof createMessageProcessor> | undefined;
  if (config.agent !== undefined && isValidAgentConfig(config.agent)) {
    const assembly = assembleAgent(config.agent);
    store = assembly.conversationStore;
    processor = assembly.messageProcessor;
    console.log(
      `AI agent active: ${config.agent.provider}/${config.agent.model}`,
    );
    pruneInterval = setInterval(
      () => store?.pruneStale(24 * 60 * 60 * 1000),
      60 * 60 * 1000,
    );
  }
  let heartbeat: HeartbeatRunner | undefined;
  if (processor) {
    heartbeat = setupHeartbeat(config, processor, adapters);
  }
  const server = deps.createGatewayServer({
    port: config.gateway.port,
    authToken: config.gateway.authToken,
    adapters,
    pairingStorePath: deps.pairingStorePath,
    getDmSettings: (p) => dmSettingsFromConfig(config, p),
    messageProcessor: processor,
    conversationStore: store,
  });
  await connectAll(adapters);
  try {
    await server.start();
    if (heartbeat) {
      heartbeat.start();
      console.log(`Heartbeat active: every ${config.heartbeat?.every}`);
    }
    console.log("Gateway running. Press Ctrl+C to stop.");
    await (deps.waitForShutdown ?? waitForSigint)();
  } finally {
    heartbeat?.stop();
    if (pruneInterval !== undefined) clearInterval(pruneInterval);
    await server.stop().catch(() => undefined);
    await disconnectAll(adapters);
  }
}

export function createGatewayStartDeps(): GatewayStartDeps {
  return {
    configPath: join(homedir(), ".closeclaw", "config.json"),
    pairingStorePath: join(homedir(), ".closeclaw", "pairing.json"),
    readConfig,
    createAdapter: createAdapterFromPackage,
    createGatewayServer: createGatewayServerImpl,
  };
}
