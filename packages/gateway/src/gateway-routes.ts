import type { IncomingMessage, ServerResponse } from "node:http";
import type { BotAdapter } from "@closeclaw/bot-adapters";
import { checkHealth } from "./health-checker.js";
import type { PairingManager } from "./pairing-manager.js";
import type { GatewayServerConfig } from "./gateway-server.js";
import { handleWebhook } from "./webhook-handler.js";

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
  writeJsonData(res, 200, await checkHealth(adapters));
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

export interface WebhookRouteConfig {
  store?: GatewayServerConfig["workflowStore"];
  onTrigger?: (workflow: unknown) => Promise<void>;
}

export async function routeRequest(
  method: string | undefined,
  path: string,
  adapters: BotAdapter[],
  res: ServerResponse,
  authToken: string,
  pairingManager: PairingManager | undefined,
  req: IncomingMessage,
  conversationStore: GatewayServerConfig["conversationStore"],
  webhookConfig?: WebhookRouteConfig,
): Promise<void> {
  if (
    await routeAgentConversations(
      method,
      path,
      req,
      res,
      authToken,
      conversationStore,
    )
  )
    return;
  if (await routeWebhook(method, path, req, res, webhookConfig)) return;
  if (
    await routeHealthOrPairing(
      method,
      path,
      adapters,
      res,
      authToken,
      pairingManager,
      req,
    )
  )
    return;
  notFound(res);
}

async function routeWebhook(
  method: string | undefined,
  path: string,
  req: IncomingMessage,
  res: ServerResponse,
  config?: WebhookRouteConfig,
): Promise<boolean> {
  if (method !== "POST" || !path.startsWith("/webhook/")) return false;
  if (!config?.store) {
    notFound(res);
    return true;
  }
  const workflowId = path.slice("/webhook/".length);
  const secret = req.headers["x-webhook-secret"];
  await handleWebhook(
    workflowId,
    typeof secret === "string" ? secret : "",
    config.store,
    res,
    config.onTrigger as
      | ((wf: {
          id: string;
          status: string;
          trigger: { type: string; webhookSecret?: string };
        }) => Promise<void>)
      | undefined,
  );
  return true;
}
