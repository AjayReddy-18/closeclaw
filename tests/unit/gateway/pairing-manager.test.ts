import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { BotPlatform, PairingStatus } from "@closeclaw/shared-types";
import { createPairingManager } from "../../../packages/gateway/src/pairing-manager.js";

describe("createPairingManager", () => {
  let dir: string;
  let storePath: string;

  beforeEach(() => {
    dir = join(tmpdir(), `closeclaw-pair-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    storePath = join(dir, "pairing.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("generates 6-character uppercase alphanumeric codes", async () => {
    const mgr = createPairingManager(storePath);
    const codes = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const req = await mgr.createRequest(
        BotPlatform.TELEGRAM,
        String(1_000_000 + i),
      );
      expect(req.code).toMatch(/^[A-Z0-9]{6}$/);
      codes.add(req.code);
    }
    expect(codes.size).toBeGreaterThan(1);
  });

  it("creates request with approximately 1 hour expiry", async () => {
    const mgr = createPairingManager(storePath);
    const before = Date.now();
    const req = await mgr.createRequest(BotPlatform.DISCORD, "user-1", "Bob");
    const created = new Date(req.createdAt).getTime();
    const expires = new Date(req.expiresAt).getTime();
    expect(created).toBeGreaterThanOrEqual(before - 2000);
    expect(created).toBeLessThanOrEqual(Date.now() + 2000);
    const ttlMs = expires - created;
    expect(ttlMs).toBeGreaterThan(59 * 60 * 1000);
    expect(ttlMs).toBeLessThan(61 * 60 * 1000);
    expect(req.status).toBe(PairingStatus.PENDING);
    expect(req.senderPlatform).toBe(BotPlatform.DISCORD);
    expect(req.senderId).toBe("user-1");
    expect(req.senderDisplayName).toBe("Bob");
  });

  it("lists only pending non-expired requests", async () => {
    const mgr = createPairingManager(storePath);
    const fresh = await mgr.createRequest(BotPlatform.TELEGRAM, "a");
    writeFileSync(
      storePath,
      JSON.stringify({
        requests: [
          fresh,
          {
            ...fresh,
            code: "ZZZZZZ",
            senderId: "b",
            status: PairingStatus.APPROVED,
          },
          {
            ...fresh,
            code: "YYYYYY",
            senderId: "c",
            expiresAt: new Date(Date.now() - 1000).toISOString(),
            status: PairingStatus.PENDING,
          },
        ],
        approvedSenders: [],
      }),
      "utf-8",
    );
    const mgr2 = createPairingManager(storePath);
    const pending = await mgr2.listPending();
    expect(pending.map((r) => r.senderId).sort()).toEqual(["a"]);
  });

  it("approve moves request to approved and adds approvedSender", async () => {
    const mgr = createPairingManager(storePath);
    const req = await mgr.createRequest(BotPlatform.TELEGRAM, "u1", "Ann");
    const approved = await mgr.approve(req.code);
    expect(approved).not.toBeNull();
    expect(approved!.platform).toBe(BotPlatform.TELEGRAM);
    expect(approved!.senderId).toBe("u1");
    expect(approved!.displayName).toBe("Ann");
    expect(new Date(approved!.approvedAt).getTime()).not.toBeNaN();
    const mgr2 = createPairingManager(storePath);
    expect(await mgr2.listPending()).toHaveLength(0);
    const raw = JSON.parse(readFileSync(storePath, "utf-8")) as {
      requests: { status: string }[];
      approvedSenders: unknown[];
    };
    expect(raw.approvedSenders).toHaveLength(1);
    const updated = raw.requests.find((r) => r.status === "approved");
    expect(updated).toBeDefined();
  });

  it("approve returns null for unknown code", async () => {
    const mgr = createPairingManager(storePath);
    await mgr.createRequest(BotPlatform.TELEGRAM, "x");
    expect(await mgr.approve("XXXXXX")).toBeNull();
  });

  it("approve returns null for expired pending code", async () => {
    writeFileSync(
      storePath,
      JSON.stringify({
        requests: [
          {
            code: "ABCDEF",
            senderPlatform: BotPlatform.TELEGRAM,
            senderId: "1",
            createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
            status: PairingStatus.PENDING,
          },
        ],
        approvedSenders: [],
      }),
      "utf-8",
    );
    const mgr = createPairingManager(storePath);
    expect(await mgr.approve("ABCDEF")).toBeNull();
  });

  it("expireStale marks old pending requests expired", async () => {
    writeFileSync(
      storePath,
      JSON.stringify({
        requests: [
          {
            code: "STALE1",
            senderPlatform: BotPlatform.TELEGRAM,
            senderId: "1",
            createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() - 1000).toISOString(),
            status: PairingStatus.PENDING,
          },
        ],
        approvedSenders: [],
      }),
      "utf-8",
    );
    const mgr = createPairingManager(storePath);
    expect(await mgr.expireStale()).toBe(1);
    const mgr2 = createPairingManager(storePath);
    expect(await mgr2.listPending()).toHaveLength(0);
    const raw = JSON.parse(readFileSync(storePath, "utf-8")) as {
      requests: { code: string; status: string }[];
    };
    const stale = raw.requests.find((r) => r.code === "STALE1");
    expect(stale?.status).toBe(PairingStatus.EXPIRED);
  });
});
