import { describe, it, expect, afterEach, vi } from "vitest";
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
      http
        .get(`${baseUrl}/health`, (res) => {
          expect(res.statusCode).toBe(200);
          const chunks: Buffer[] = [];
          res.on("data", (c) => {
            chunks.push(c as Buffer);
          });
          res.on("end", () => {
            resolve(Buffer.concat(chunks).toString("utf-8"));
          });
          res.on("error", reject);
        })
        .on("error", reject);
    });
    const json = JSON.parse(body) as { status: string };
    expect(json.status).toBe("healthy");
  });

  it("uses the next port when the requested port is in use", async () => {
    const blocker = http.createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.listen(0, "127.0.0.1", () => resolve());
      blocker.on("error", reject);
    });
    const a = blocker.address();
    if (typeof a !== "object" || a === null || !("port" in a)) {
      throw new Error("expected AddressInfo");
    }
    const taken = a.port;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const srv = createGatewayServer({
      port: taken,
      authToken: "z".repeat(64),
      adapters: [],
    });
    servers.push(srv);
    await srv.start();
    expect(logSpy).toHaveBeenCalledWith(
      `Gateway listening on port ${String(taken + 1)}`,
    );
    const gAddr = srv.address();
    if (typeof gAddr !== "object" || gAddr === null || !("port" in gAddr)) {
      throw new Error("expected AddressInfo");
    }
    expect(gAddr.port).toBe(taken + 1);
    logSpy.mockRestore();
    await new Promise<void>((resolve, reject) => {
      blocker.close((err) => (err ? reject(err) : resolve()));
    });
  });
});
