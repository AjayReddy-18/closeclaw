import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type {
  BotAdapter,
  IncomingMessage as BotIncomingMessage,
} from "@closeclaw/bot-adapters";
import type { BotPlatform, DmPolicy } from "@closeclaw/shared-types";
import { checkHealth, type HealthCheckResult } from "./health-checker.js";
import { createDmPolicyEnforcer } from "./dm-policy-enforcer.js";
import {
  createPairingManager,
  type PairingManager,
} from "./pairing-manager.js";

const GATEWAY_PROCESSING_FAILED =
  "I'm having trouble thinking right now. Please try again in a moment.";

const PROCESSING_ACK_DELAY_MS = 5000;

const senderQueues = new Map<string, Promise<void>>();

function enqueueForSender(key: string, task: () => Promise<void>): void {
  const prev = senderQueues.get(key) ?? Promise.resolve();
  const next = prev.then(task, task);
  senderQueues.set(key, next);
}

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

function writeJson(res: ServerResponse, body: HealthCheckResult): void {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function writeJsonData(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function serveHealth(
  adapters: BotAdapter[],
  res: ServerResponse,
): Promise<void> {
  const payload = await checkHealth(adapters);
  writeJson(res, payload);
}

function notFound(res: ServerResponse): void {
  res.statusCode = 404;
  res.end();
}

function unauthorized(res: ServerResponse): void {
  res.statusCode = 401;
  res.end();
}

function bearerMatches(req: IncomingMessage, token: string): boolean {
  const h = req.headers.authorization;
  if (typeof h !== "string" || !h.startsWith("Bearer ")) return false;
  return h.slice(7).trim() === token;
}

async function readBodyJson(req: IncomingMessage): Promise<unknown> {
  const buffers: Buffer[] = [];
  for await (const chunk of req) {
    buffers.push(chunk as Buffer);
  }
  const text = Buffer.concat(buffers).toString("utf-8").trim();
  if (text.length === 0) return {};
  return JSON.parse(text) as unknown;
}

function extractCode(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const c = (body as Record<string, unknown>)["code"];
  return typeof c === "string" ? c : undefined;
}

async function servePairingList(
  mgr: PairingManager,
  res: ServerResponse,
): Promise<void> {
  const rows = await mgr.listPending();
  writeJsonData(res, 200, rows);
}

function serveConversationsList(
  store: GatewayServerConfig["conversationStore"],
  res: ServerResponse,
): void {
  const rows = store?.list() ?? [];
  writeJsonData(res, 200, rows);
}

async function routeAgentConversations(
  method: string | undefined,
  path: string,
  req: IncomingMessage,
  res: ServerResponse,
  authToken: string,
  conversationStore: GatewayServerConfig["conversationStore"],
): Promise<boolean> {
  if (method !== "GET" || path !== "/agent/conversations") return false;
  if (!bearerMatches(req, authToken)) {
    unauthorized(res);
    return true;
  }
  serveConversationsList(conversationStore, res);
  return true;
}

async function servePairingApprove(
  req: IncomingMessage,
  mgr: PairingManager,
  res: ServerResponse,
): Promise<void> {
  const body = await readBodyJson(req);
  const code = extractCode(body);
  if (!code) {
    writeJsonData(res, 400, { ok: false });
    return;
  }
  const approved = await mgr.approve(code);
  if (!approved) {
    writeJsonData(res, 400, { ok: false });
    return;
  }
  writeJsonData(res, 200, {
    ok: true,
    senderId: approved.senderId,
    platform: approved.platform,
  });
}

async function pairingAuthedRoutes(
  method: string | undefined,
  path: string,
  req: IncomingMessage,
  res: ServerResponse,
  authToken: string,
  mgr: PairingManager,
): Promise<boolean> {
  if (method === "GET" && path === "/pairing") {
    if (!bearerMatches(req, authToken)) {
      unauthorized(res);
      return true;
    }
    await servePairingList(mgr, res);
    return true;
  }
  if (method === "POST" && path === "/pairing/approve") {
    if (!bearerMatches(req, authToken)) {
      unauthorized(res);
      return true;
    }
    await servePairingApprove(req, mgr, res);
    return true;
  }
  return false;
}

async function routeHealthOrPairing(
  method: string | undefined,
  path: string,
  adapters: BotAdapter[],
  res: ServerResponse,
  authToken: string,
  pairingManager: PairingManager | undefined,
  req: IncomingMessage,
): Promise<boolean> {
  if (method === "GET" && path === "/health") {
    await serveHealth(adapters, res);
    return true;
  }
  if (!pairingManager) return false;
  return pairingAuthedRoutes(method, path, req, res, authToken, pairingManager);
}

async function routeRequest(
  method: string | undefined,
  path: string,
  adapters: BotAdapter[],
  res: ServerResponse,
  authToken: string,
  pairingManager: PairingManager | undefined,
  req: IncomingMessage,
  conversationStore: GatewayServerConfig["conversationStore"],
): Promise<void> {
  const agentHit = await routeAgentConversations(
    method,
    path,
    req,
    res,
    authToken,
    conversationStore,
  );
  if (agentHit) return;
  const hit = await routeHealthOrPairing(
    method,
    path,
    adapters,
    res,
    authToken,
    pairingManager,
    req,
  );
  if (!hit) notFound(res);
}

function parsePath(url: string | undefined): string {
  if (!url) return "";
  return url.split("?")[0] ?? "";
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

function logBoundPort(server: Server): void {
  const a = server.address();
  if (typeof a === "object" && a !== null && "port" in a) {
    console.log(`Gateway listening on port ${String(a.port)}`);
  }
}

async function listenWithPortFallback(
  server: Server,
  basePort: number,
): Promise<void> {
  for (let i = 0; i < LISTEN_PORT_ATTEMPTS; i++) {
    const port = basePort + i;
    try {
      await listenOnce(server, port);
      logBoundPort(server);
      return;
    } catch (e) {
      const canRetry = i < LISTEN_PORT_ATTEMPTS - 1;
      if (!isAddrInUse(e) || !canRetry) throw e;
    }
  }
}

function closePromise(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function formatPairingReply(pairingCode: string): string {
  return `Pairing code: ${pairingCode}\nAsk the owner to run: closeclaw pairing approve ${pairingCode}`;
}

async function maybeSendPairingReply(
  adapter: BotAdapter,
  allowed: boolean,
  pairingCode: string | undefined,
  senderId: string,
): Promise<void> {
  if (allowed || pairingCode === undefined) return;
  await adapter.sendMessage(senderId, formatPairingReply(pairingCode));
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

function logAcceptedMessage(msg: BotIncomingMessage): void {
  const sender = msg.senderDisplayName ?? msg.senderId;
  console.log(`[${msg.platform}] Message from ${sender}: ${msg.text}`);
}

async function runAgentResponse(
  adapter: BotAdapter,
  processor: NonNullable<GatewayServerConfig["messageProcessor"]>,
  msg: BotIncomingMessage,
): Promise<void> {
  void Promise.resolve(adapter.sendTypingIndicator(msg.senderId)).catch(
    () => {},
  );
  const processingTimer = setTimeout(() => {
    void adapter
      .sendMessage(msg.senderId, "Processing your message...")
      .catch(() => {});
  }, PROCESSING_ACK_DELAY_MS);
  try {
    const response = await processor.processMessage(
      msg.platform,
      msg.senderId,
      msg.text,
      msg.senderDisplayName,
    );
    clearTimeout(processingTimer);
    await adapter.sendMessage(msg.senderId, response);
  } catch (error) {
    console.error("[gateway] Message processing failed:", error);
    clearTimeout(processingTimer);
    await adapter.sendMessage(msg.senderId, GATEWAY_PROCESSING_FAILED);
  }
}

async function handleAdapterMessage(
  adapter: BotAdapter,
  pairingManager: PairingManager,
  msg: BotIncomingMessage,
  resolver: NonNullable<GatewayServerConfig["getDmSettings"]>,
  messageProcessor: GatewayServerConfig["messageProcessor"],
): Promise<void> {
  const settings = resolver(msg.platform);
  const enforcer = createDmPolicyEnforcer({
    dmPolicy: settings.dmPolicy,
    allowedSenders: settings.allowedSenders,
    pairingManager,
  });
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
    stop: () => closePromise(server),
    address: () => server.address(),
  };
}
