import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { BotAdapter, IncomingMessage as BotIncomingMessage } from "@closeclaw/bot-adapters";
import type { BotPlatform, DmPolicy } from "@closeclaw/shared-types";
import { checkHealth, type HealthCheckResult } from "./health-checker.js";
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

function writeJsonData(res: ServerResponse, status: number, body: unknown): void {
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
  return pairingAuthedRoutes(
    method,
    path,
    req,
    res,
    authToken,
    pairingManager,
  );
}

async function routeRequest(
  method: string | undefined,
  path: string,
  adapters: BotAdapter[],
  res: ServerResponse,
  authToken: string,
  pairingManager: PairingManager | undefined,
  req: IncomingMessage,
): Promise<void> {
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

function listenPromise(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.listen(port, "127.0.0.1", () => resolve());
    server.once("error", reject);
  });
}

function closePromise(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
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
      void handleAdapterMessage(pairingManager, msg, resolver);
    });
  }
}

async function handleAdapterMessage(
  pairingManager: PairingManager,
  msg: BotIncomingMessage,
  resolver: NonNullable<GatewayServerConfig["getDmSettings"]>,
): Promise<void> {
  const settings = resolver(msg.platform);
  const enforcer = createDmPolicyEnforcer({
    dmPolicy: settings.dmPolicy,
    allowedSenders: settings.allowedSenders,
    pairingManager,
  });
  await enforcer.shouldAllow(msg.senderId, msg.platform);
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
    ).catch(() => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end();
      }
    });
  });
  return {
    start: () => listenPromise(server, config.port),
    stop: () => closePromise(server),
    address: () => server.address(),
  };
}
