import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { BotAdapter } from "@closeclaw/bot-adapters";
import { BotPlatform } from "@closeclaw/shared-types";
import { createGatewayServer } from "../../packages/gateway/src/gateway-server.js";
import { createPairingManager } from "../../packages/gateway/src/pairing-manager.js";

const runOnboardMock = vi.hoisted(() => vi.fn());

vi.mock("../../packages/cli/src/commands/onboard.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../packages/cli/src/commands/onboard.js")
  >("../../packages/cli/src/commands/onboard.js");
  return { ...actual, runOnboard: runOnboardMock };
});

describe("closeclaw onboard exit codes", () => {
  beforeEach(() => {
    runOnboardMock.mockReset();
  });

  it("returns exit code 0 when onboard succeeds", async () => {
    runOnboardMock.mockResolvedValue(undefined);
    const { runCli } = await import("../../packages/cli/src/cli.js");
    const code = await runCli(["node", "closeclaw", "onboard"]);
    expect(code).toBe(0);
    expect(runOnboardMock).toHaveBeenCalledTimes(1);
  });

  it("returns exit code 1 when onboard fails", async () => {
    runOnboardMock.mockRejectedValue(new Error("failed"));
    const { runCli } = await import("../../packages/cli/src/cli.js");
    const code = await runCli(["node", "closeclaw", "onboard"]);
    expect(code).toBe(1);
  });
});

describe("gateway pairing HTTP", () => {
  let dir: string;
  let storePath: string;
  const token = "b".repeat(64);
  const servers: ReturnType<typeof createGatewayServer>[] = [];

  afterEach(async () => {
    for (const s of servers.splice(0)) {
      await s.stop().catch(() => undefined);
    }
    rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    dir = join(tmpdir(), `closeclaw-gw-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    storePath = join(dir, "pairing.json");
  });

  function mockAdapter(): BotAdapter {
    return {
      platform: BotPlatform.TELEGRAM,
      connect: vi.fn(),
      disconnect: vi.fn(),
      healthCheck: vi.fn(() =>
        Promise.resolve({ connected: true }),
      ),
      onMessage: vi.fn(),
    };
  }

  async function baseUrl(srv: ReturnType<typeof createGatewayServer>) {
    const addr = srv.address();
    if (addr && typeof addr === "object" && "port" in addr) {
      return `http://127.0.0.1:${String(addr.port)}`;
    }
    throw new Error("no address");
  }

  it("GET /pairing returns pending requests with valid Bearer auth", async () => {
    const srv = createGatewayServer({
      port: 0,
      authToken: token,
      adapters: [mockAdapter()],
      pairingStorePath: storePath,
    });
    servers.push(srv);
    await srv.start();
    const url = await baseUrl(srv);
    const empty = await fetch(`${url}/pairing`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual([]);
    const seed = await createPairingManager(storePath).createRequest(
      BotPlatform.TELEGRAM,
      "7",
    );
    const res = await fetch(`${url}/pairing`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { code: string }[];
    expect(body).toHaveLength(1);
    expect(body[0]!.code).toBe(seed.code);
  });

  it("GET /pairing returns 401 without auth", async () => {
    const srv = createGatewayServer({
      port: 0,
      authToken: token,
      adapters: [mockAdapter()],
      pairingStorePath: storePath,
    });
    servers.push(srv);
    await srv.start();
    const url = await baseUrl(srv);
    const res = await fetch(`${url}/pairing`);
    expect(res.status).toBe(401);
  });

  it("POST /pairing/approve approves by code with auth", async () => {
    const mgr = createPairingManager(storePath);
    const req = await mgr.createRequest(BotPlatform.DISCORD, "user-x");
    const srv = createGatewayServer({
      port: 0,
      authToken: token,
      adapters: [mockAdapter()],
      pairingStorePath: storePath,
    });
    servers.push(srv);
    await srv.start();
    const url = await baseUrl(srv);
    const res = await fetch(`${url}/pairing/approve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: req.code }),
    });
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { ok: boolean; senderId: string };
    expect(payload.ok).toBe(true);
    expect(payload.senderId).toBe("user-x");
    const list = await fetch(`${url}/pairing`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(await list.json()).toEqual([]);
  });

  it("POST /pairing/approve returns 400 for unknown code", async () => {
    const srv = createGatewayServer({
      port: 0,
      authToken: token,
      adapters: [mockAdapter()],
      pairingStorePath: storePath,
    });
    servers.push(srv);
    await srv.start();
    const url = await baseUrl(srv);
    const res = await fetch(`${url}/pairing/approve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: "QQQQQQ" }),
    });
    expect(res.status).toBe(400);
  });
});
