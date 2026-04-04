import { describe, it, expect, afterEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createGatewayServer } from "../../../packages/gateway/src/gateway-server.js";

describe("createGatewayServer", () => {
  const servers: ReturnType<typeof createGatewayServer>[] = [];

  afterEach(async () => {
    for (const s of servers.splice(0)) {
      await s.stop().catch(() => undefined);
    }
  });

  it("GET /health returns 200 with status payload", async () => {
    const srv = createGatewayServer({
      port: 0,
      authToken: "z".repeat(64),
      adapters: [],
    });
    servers.push(srv);
    await srv.start();
    const addr = srv.address();
    expect(addr).not.toBeNull();
    let baseUrl: string;
    if (typeof addr === "object" && addr !== null && "port" in addr) {
      const a = addr as AddressInfo;
      baseUrl = `http://127.0.0.1:${String(a.port)}`;
    } else if (typeof addr === "string") {
      baseUrl = `http://${addr}`;
    } else {
      throw new Error(String(addr));
    }
    const body = await new Promise<string>((resolve, reject) => {
      http.get(`${baseUrl}/health`, (res) => {
        expect(res.statusCode).toBe(200);
        const chunks: Buffer[] = [];
        res.on("data", (c) => {
          chunks.push(c as Buffer);
        });
        res.on("end", () => {
          resolve(Buffer.concat(chunks).toString("utf-8"));
        });
        res.on("error", reject);
      }).on("error", reject);
    });
    const json = JSON.parse(body) as { status: string };
    expect(json.status).toBe("healthy");
  });
});
