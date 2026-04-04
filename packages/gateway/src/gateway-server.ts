import {
  createServer,
  type Server,
  type ServerResponse,
} from "node:http";
import type { BotAdapter } from "@closeclaw/bot-adapters";
import { checkHealth, type HealthCheckResult } from "./health-checker.js";

export type GatewayServerConfig = {
  port: number;
  authToken: string;
  adapters: BotAdapter[];
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

async function serveHealth(
  adapters: BotAdapter[],
  res: ServerResponse,
): Promise<void> {
  const body = await checkHealth(adapters);
  writeJson(res, body);
}

function notFound(res: ServerResponse): void {
  res.statusCode = 404;
  res.end();
}

function routeRequest(
  method: string | undefined,
  path: string,
  adapters: BotAdapter[],
  res: ServerResponse,
): void {
  if (method === "GET" && path === "/health") {
    void serveHealth(adapters, res);
    return;
  }
  notFound(res);
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

export function createGatewayServer(
  config: GatewayServerConfig,
): GatewayServer {
  const server = createServer((req, res) => {
    routeRequest(req.method, parsePath(req.url), config.adapters, res);
  });
  return {
    start: () => listenPromise(server, config.port),
    stop: () => closePromise(server),
    address: () => server.address(),
  };
}
