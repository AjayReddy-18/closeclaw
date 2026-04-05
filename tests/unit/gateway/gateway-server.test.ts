import { mkdirSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, afterEach, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { BotAdapter } from "@closeclaw/bot-adapters";
import { BotPlatform, DmPolicy } from "@closeclaw/shared-types";
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

  it("returns 404 for unknown routes", async () => {
    const srv = createGatewayServer({
      port: 0,
      authToken: "z".repeat(64),
      adapters: [],
    });
    servers.push(srv);
    await srv.start();
    const addr = srv.address();
    if (typeof addr !== "object" || addr === null || !("port" in addr)) {
      throw new Error("expected AddressInfo");
    }
    const url = `http://127.0.0.1:${String(addr.port)}/unknown`;
    const res = await new Promise<{ statusCode: number }>((resolve, reject) => {
      http
        .get(url, (r) => resolve({ statusCode: r.statusCode ?? 0 }))
        .on("error", reject);
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 when POST /pairing/approve has no code", async () => {
    const { mkdirSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { randomUUID } = await import("node:crypto");
    const dir = join(tmpdir(), `closeclaw-gw-nc-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    const storePath = join(dir, "pairing.json");
    const token = "t".repeat(64);
    const srv = createGatewayServer({
      port: 0,
      authToken: token,
      adapters: [],
      pairingStorePath: storePath,
    });
    servers.push(srv);
    await srv.start();
    const addr = srv.address();
    if (typeof addr !== "object" || addr === null || !("port" in addr)) {
      throw new Error("expected AddressInfo");
    }
    const url = `http://127.0.0.1:${String(addr.port)}/pairing/approve`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns 401 for POST /pairing/approve without auth", async () => {
    const { mkdirSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { randomUUID } = await import("node:crypto");
    const dir = join(tmpdir(), `closeclaw-gw-pa-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    const storePath = join(dir, "pairing.json");
    const token = "t".repeat(64);
    const srv = createGatewayServer({
      port: 0,
      authToken: token,
      adapters: [],
      pairingStorePath: storePath,
    });
    servers.push(srv);
    await srv.start();
    const addr = srv.address();
    if (typeof addr !== "object" || addr === null || !("port" in addr)) {
      throw new Error("expected AddressInfo");
    }
    const url = `http://127.0.0.1:${String(addr.port)}/pairing/approve`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "AAAAAA" }),
    });
    expect(res.status).toBe(401);
    rmSync(dir, { recursive: true, force: true });
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

  describe("agent routing", () => {
    let dir: string | undefined;
    let storePath: string;

    afterEach(() => {
      if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
      dir = undefined;
    });

    it("sends typing, runs processMessage, and sends response when configured", async () => {
      dir = join(tmpdir(), `closeclaw-gw-ag-${randomUUID()}`);
      mkdirSync(dir, { recursive: true });
      storePath = join(dir, "pairing.json");
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      const sendTypingIndicator = vi.fn().mockResolvedValue(undefined);
      const processMessage = vi.fn().mockResolvedValue("ai reply");
      const adapter: BotAdapter = {
        platform: BotPlatform.TELEGRAM,
        connect: vi.fn(),
        disconnect: vi.fn(),
        healthCheck: vi.fn().mockResolvedValue({ connected: true }),
        onMessage: vi.fn(),
        sendMessage,
        sendTypingIndicator,
      };
      const srv = createGatewayServer({
        port: 0,
        authToken: "z".repeat(64),
        adapters: [adapter],
        pairingStorePath: storePath,
        getDmSettings: () => ({ dmPolicy: DmPolicy.OPEN }),
        messageProcessor: { processMessage },
      });
      servers.push(srv);
      await srv.start();
      const onMsg = vi.mocked(adapter.onMessage).mock.calls[0]![0];
      onMsg({
        platform: BotPlatform.TELEGRAM,
        senderId: "7",
        senderDisplayName: "Sam",
        text: "hi",
        timestamp: new Date(),
      });
      await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled());
      expect(sendTypingIndicator).toHaveBeenCalledWith("7");
      expect(processMessage).toHaveBeenCalledWith(
        BotPlatform.TELEGRAM,
        "7",
        "hi",
        "Sam",
      );
      expect(sendMessage).toHaveBeenCalledWith("7", "ai reply");
    });

    it("logs only when messageProcessor is omitted", async () => {
      dir = join(tmpdir(), `closeclaw-gw-log-${randomUUID()}`);
      mkdirSync(dir, { recursive: true });
      storePath = join(dir, "pairing.json");
      const logSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => undefined);
      const adapter: BotAdapter = {
        platform: BotPlatform.TELEGRAM,
        connect: vi.fn(),
        disconnect: vi.fn(),
        healthCheck: vi.fn().mockResolvedValue({ connected: true }),
        onMessage: vi.fn(),
        sendMessage: vi.fn(),
        sendTypingIndicator: vi.fn(),
      };
      const srv = createGatewayServer({
        port: 0,
        authToken: "z".repeat(64),
        adapters: [adapter],
        pairingStorePath: storePath,
        getDmSettings: () => ({ dmPolicy: DmPolicy.OPEN }),
      });
      servers.push(srv);
      await srv.start();
      const onMsg = vi.mocked(adapter.onMessage).mock.calls[0]![0];
      onMsg({
        platform: BotPlatform.TELEGRAM,
        senderId: "1",
        text: "only log",
        timestamp: new Date(),
      });
      await new Promise<void>((r) => setImmediate(r));
      expect(logSpy).toHaveBeenCalledWith(
        "[telegram] Message from 1: only log",
      );
      logSpy.mockRestore();
    });

    it("sends error text when processMessage throws", async () => {
      dir = join(tmpdir(), `closeclaw-gw-err-${randomUUID()}`);
      mkdirSync(dir, { recursive: true });
      storePath = join(dir, "pairing.json");
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      const adapter: BotAdapter = {
        platform: BotPlatform.TELEGRAM,
        connect: vi.fn(),
        disconnect: vi.fn(),
        healthCheck: vi.fn().mockResolvedValue({ connected: true }),
        onMessage: vi.fn(),
        sendMessage,
        sendTypingIndicator: vi.fn(),
      };
      const srv = createGatewayServer({
        port: 0,
        authToken: "z".repeat(64),
        adapters: [adapter],
        pairingStorePath: storePath,
        getDmSettings: () => ({ dmPolicy: DmPolicy.OPEN }),
        messageProcessor: {
          processMessage: vi.fn().mockRejectedValue(new Error("fail")),
        },
      });
      servers.push(srv);
      await srv.start();
      const onMsg = vi.mocked(adapter.onMessage).mock.calls[0]![0];
      onMsg({
        platform: BotPlatform.TELEGRAM,
        senderId: "9",
        text: "x",
        timestamp: new Date(),
      });
      await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled());
      expect(sendMessage).toHaveBeenCalledWith(
        "9",
        "I'm having trouble thinking right now. Please try again in a moment.",
      );
    });

    it("does not send interim message when processMessage resolves quickly", async () => {
      dir = join(tmpdir(), `closeclaw-gw-fast-${randomUUID()}`);
      mkdirSync(dir, { recursive: true });
      storePath = join(dir, "pairing.json");
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      const processMessage = vi.fn().mockResolvedValue("quick");
      const adapter: BotAdapter = {
        platform: BotPlatform.TELEGRAM,
        connect: vi.fn(),
        disconnect: vi.fn(),
        healthCheck: vi.fn().mockResolvedValue({ connected: true }),
        onMessage: vi.fn(),
        sendMessage,
        sendTypingIndicator: vi.fn(),
      };
      const srv = createGatewayServer({
        port: 0,
        authToken: "z".repeat(64),
        adapters: [adapter],
        pairingStorePath: storePath,
        getDmSettings: () => ({ dmPolicy: DmPolicy.OPEN }),
        messageProcessor: { processMessage },
      });
      servers.push(srv);
      await srv.start();
      const onMsg = vi.mocked(adapter.onMessage).mock.calls[0]![0];
      onMsg({
        platform: BotPlatform.TELEGRAM,
        senderId: "22",
        text: "hi",
        timestamp: new Date(),
      });
      await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled());
      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith("22", "quick");
    });

    it("sends interim processing message when processMessage is slow", async () => {
      dir = join(tmpdir(), `closeclaw-gw-slow-${randomUUID()}`);
      mkdirSync(dir, { recursive: true });
      storePath = join(dir, "pairing.json");
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      let resolveProc!: (v: string) => void;
      const processMessage = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveProc = resolve;
          }),
      );
      const adapter: BotAdapter = {
        platform: BotPlatform.TELEGRAM,
        connect: vi.fn(),
        disconnect: vi.fn(),
        healthCheck: vi.fn().mockResolvedValue({ connected: true }),
        onMessage: vi.fn(),
        sendMessage,
        sendTypingIndicator: vi.fn(),
      };
      const srv = createGatewayServer({
        port: 0,
        authToken: "z".repeat(64),
        adapters: [adapter],
        pairingStorePath: storePath,
        getDmSettings: () => ({ dmPolicy: DmPolicy.OPEN }),
        messageProcessor: { processMessage },
      });
      servers.push(srv);
      await srv.start();
      vi.useFakeTimers();
      try {
        const onMsg = vi.mocked(adapter.onMessage).mock.calls[0]![0];
        onMsg({
          platform: BotPlatform.TELEGRAM,
          senderId: "33",
          text: "slow",
          timestamp: new Date(),
        });
        await vi.advanceTimersByTimeAsync(5000);
        expect(sendMessage).toHaveBeenCalledWith(
          "33",
          "Processing your message...",
        );
        resolveProc!("final");
        await vi.waitFor(() =>
          expect(sendMessage).toHaveBeenCalledWith("33", "final"),
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("GET /agent/conversations", () => {
    function baseUrlFromServer(
      srv: ReturnType<typeof createGatewayServer>,
    ): string {
      const addr = srv.address();
      if (typeof addr !== "object" || addr === null || !("port" in addr)) {
        throw new Error("expected AddressInfo");
      }
      return `http://127.0.0.1:${String(addr.port)}`;
    }

    it("returns empty array when no conversationStore configured", async () => {
      const token = "z".repeat(64);
      const srv = createGatewayServer({
        port: 0,
        authToken: token,
        adapters: [],
      });
      servers.push(srv);
      await srv.start();
      const res = await fetch(`${baseUrlFromServer(srv)}/agent/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as unknown[];
      expect(body).toEqual([]);
    });

    it("returns conversation list when conversationStore is configured", async () => {
      const token = "a".repeat(64);
      const lastAt = new Date("2026-04-01T12:00:00.000Z");
      const srv = createGatewayServer({
        port: 0,
        authToken: token,
        adapters: [],
        conversationStore: {
          list: () => [
            {
              platform: "telegram",
              senderId: "u1",
              senderDisplayName: "Sam",
              messageCount: 2,
              lastActivityAt: lastAt,
            },
          ],
        },
      });
      servers.push(srv);
      await srv.start();
      const res = await fetch(`${baseUrlFromServer(srv)}/agent/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Array<{
        platform: string;
        senderId: string;
        senderDisplayName?: string;
        messageCount: number;
        lastActivityAt: string;
      }>;
      expect(body).toHaveLength(1);
      expect(body[0]?.platform).toBe("telegram");
      expect(body[0]?.senderId).toBe("u1");
      expect(body[0]?.senderDisplayName).toBe("Sam");
      expect(body[0]?.messageCount).toBe(2);
      expect(body[0]?.lastActivityAt).toBe(lastAt.toISOString());
    });

    it("returns 401 when no auth token provided", async () => {
      const srv = createGatewayServer({
        port: 0,
        authToken: "b".repeat(64),
        adapters: [],
      });
      servers.push(srv);
      await srv.start();
      const res = await fetch(`${baseUrlFromServer(srv)}/agent/conversations`);
      expect(res.status).toBe(401);
    });
  });
});
