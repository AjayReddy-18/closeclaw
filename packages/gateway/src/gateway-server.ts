import { createServer, type Server } from "node:http";
import type {
  BotAdapter,
  IncomingMessage as BotIncomingMessage,
} from "@closeclaw/bot-adapters";
import type { BotPlatform, DmPolicy } from "@closeclaw/shared-types";
import {
  enqueueForSender,
  logAcceptedMessage,
  maybeSendPairingReply,
  runAgentResponse,
} from "./gateway-agent-handler.js";
import { routeRequest } from "./gateway-routes.js";
import { createDmPolicyEnforcer } from "./dm-policy-enforcer.js";
import {
  createPairingManager,
  type PairingManager,
} from "./pairing-manager.js";

export type GatewayServerConfig = {
  port: number;
  authToken: string;
  adapters: BotAdapter[];
  pairingStorePath?: string;
  getDmSettings?: (platform: BotPlatform) => {
    dmPolicy: DmPolicy;
    allowedSenders?: string[];
  };
  messageProcessor?: {
    processMessage(
      platform: BotPlatform,
      senderId: string,
      text: string,
      senderDisplayName?: string,
    ): Promise<string>;
  };
  conversationStore?: {
    list(): Array<{
      platform: string;
      senderId: string;
      senderDisplayName?: string;
      messageCount: number;
      lastActivityAt: Date;
    }>;
  };
};

export type GatewayServer = {
  start(): Promise<void>;
  stop(): Promise<void>;
  address(): ReturnType<Server["address"]>;
};

function parsePath(url: string | undefined): string {
  return url?.split("?")[0] ?? "";
}

const LISTEN_PORT_ATTEMPTS = 10;

function isAddrInUse(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as NodeJS.ErrnoException).code === "EADDRINUSE"
  );
}

function listenOnce(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onErr = (e: Error) => {
      server.off("error", onErr);
      reject(e);
    };
    server.once("error", onErr);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", onErr);
      resolve();
    });
  });
}

async function listenWithPortFallback(
  server: Server,
  basePort: number,
): Promise<void> {
  for (let i = 0; i < LISTEN_PORT_ATTEMPTS; i++) {
    const port = basePort + i;
    try {
      await listenOnce(server, port);
      const a = server.address();
      if (typeof a === "object" && a !== null && "port" in a) {
        console.log(`Gateway listening on port ${String(a.port)}`);
      }
      return;
    } catch (e) {
      const canRetry = i < LISTEN_PORT_ATTEMPTS - 1;
      if (!isAddrInUse(e) || !canRetry) throw e;
    }
  }
}

function makeEnforcer(
  resolver: NonNullable<GatewayServerConfig["getDmSettings"]>,
  pairingManager: PairingManager,
  platform: BotPlatform,
) {
  const settings = resolver(platform);
  return createDmPolicyEnforcer({
    dmPolicy: settings.dmPolicy,
    allowedSenders: settings.allowedSenders,
    pairingManager,
  });
}

function wireMessageHandlers(
  cfg: GatewayServerConfig,
  pairingManager: PairingManager,
): void {
  const resolver = cfg.getDmSettings;
  if (!resolver) return;
  for (const adapter of cfg.adapters) {
    adapter.onMessage((msg: BotIncomingMessage) => {
      void handleAdapterMessage(
        adapter,
        pairingManager,
        msg,
        resolver,
        cfg.messageProcessor,
      );
    });
  }
}

async function handleAdapterMessage(
  adapter: BotAdapter,
  pairingManager: PairingManager,
  msg: BotIncomingMessage,
  resolver: NonNullable<GatewayServerConfig["getDmSettings"]>,
  messageProcessor: GatewayServerConfig["messageProcessor"],
): Promise<void> {
  const enforcer = makeEnforcer(resolver, pairingManager, msg.platform);
  const { allowed, pairingCode } = await enforcer.shouldAllow(
    msg.senderId,
    msg.platform,
  );
  if (!allowed) {
    await maybeSendPairingReply(adapter, allowed, pairingCode, msg.senderId);
    return;
  }
  if (messageProcessor) {
    logAcceptedMessage(msg);
    const key = `${msg.platform}:${msg.senderId}`;
    enqueueForSender(key, () =>
      runAgentResponse(adapter, messageProcessor, msg),
    );
    return;
  }
  logAcceptedMessage(msg);
}

export function createGatewayServer(
  config: GatewayServerConfig,
): GatewayServer {
  const pairingManager = config.pairingStorePath
    ? createPairingManager(config.pairingStorePath)
    : undefined;
  if (pairingManager) {
    wireMessageHandlers(config, pairingManager);
  }
  const server = createServer((req, res) => {
    void routeRequest(
      req.method,
      parsePath(req.url),
      config.adapters,
      res,
      config.authToken,
      pairingManager,
      req,
      config.conversationStore,
    ).catch(() => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end();
      }
    });
  });
  return {
    start: () => listenWithPortFallback(server, config.port),
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
    address: () => server.address(),
  };
}
