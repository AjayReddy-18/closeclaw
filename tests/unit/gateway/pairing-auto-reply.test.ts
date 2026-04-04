import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, afterEach } from "vitest";
import type { BotAdapter } from "@closeclaw/bot-adapters";
import { BotPlatform, DmPolicy } from "@closeclaw/shared-types";
import { createGatewayServer } from "../../../packages/gateway/src/gateway-server.js";

describe("pairing auto-reply", () => {
  let dir: string;
  let storePath: string;
  const servers: ReturnType<typeof createGatewayServer>[] = [];

  afterEach(async () => {
    for (const s of servers.splice(0)) {
      await s.stop().catch(() => undefined);
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it("sends pairing instructions when policy returns a code", async () => {
    dir = join(tmpdir(), `closeclaw-par-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    storePath = join(dir, "pairing.json");
    const sendMessage = vi.fn(async () => undefined);
    const adapter: BotAdapter = {
      platform: BotPlatform.TELEGRAM,
      connect: vi.fn(),
      disconnect: vi.fn(),
      healthCheck: vi.fn(async () => ({ connected: true })),
      onMessage: vi.fn(),
      sendMessage,
    };
    const srv = createGatewayServer({
      port: 0,
      authToken: "z".repeat(64),
      adapters: [adapter],
      pairingStorePath: storePath,
      getDmSettings: () => ({ dmPolicy: DmPolicy.PAIRING }),
    });
    servers.push(srv);
    await srv.start();
    const onMsg = vi.mocked(adapter.onMessage).mock.calls[0]![0];
    await onMsg({
      platform: BotPlatform.TELEGRAM,
      senderId: "42",
      text: "hi",
      timestamp: new Date(),
    });
    await new Promise<void>((r) => setImmediate(r));
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0]![0]).toBe("42");
    const text = sendMessage.mock.calls[0]![1] as string;
    const m = text.match(
      /^Pairing code: ([0-9A-Z]{6})\nAsk the owner to run: closeclaw pairing approve \1$/,
    );
    expect(m).not.toBeNull();
  });
});
