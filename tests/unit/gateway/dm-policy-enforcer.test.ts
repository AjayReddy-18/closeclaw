import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { BotPlatform, DmPolicy } from "@closeclaw/shared-types";
import { createPairingManager } from "../../../packages/gateway/src/pairing-manager.js";
import { createDmPolicyEnforcer } from "../../../packages/gateway/src/dm-policy-enforcer.js";

describe("createDmPolicyEnforcer", () => {
  let dir: string;
  let storePath: string;

  beforeEach(() => {
    dir = join(tmpdir(), `closeclaw-dm-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    storePath = join(dir, "pairing.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("open mode allows all senders", async () => {
    const mgr = createPairingManager(storePath);
    const enforcer = createDmPolicyEnforcer({
      dmPolicy: DmPolicy.OPEN,
      pairingManager: mgr,
    });
    expect(await enforcer.shouldAllow("any-id", BotPlatform.TELEGRAM)).toEqual({
      allowed: true,
    });
  });

  it("allowlist allows listed senders", async () => {
    const mgr = createPairingManager(storePath);
    const enforcer = createDmPolicyEnforcer({
      dmPolicy: DmPolicy.ALLOWLIST,
      allowedSenders: ["u1", "u2"],
      pairingManager: mgr,
    });
    expect(await enforcer.shouldAllow("u1", BotPlatform.DISCORD)).toEqual({
      allowed: true,
    });
  });

  it("allowlist rejects unlisted senders", async () => {
    const mgr = createPairingManager(storePath);
    const enforcer = createDmPolicyEnforcer({
      dmPolicy: DmPolicy.ALLOWLIST,
      allowedSenders: ["u1"],
      pairingManager: mgr,
    });
    expect(await enforcer.shouldAllow("other", BotPlatform.TELEGRAM)).toEqual({
      allowed: false,
    });
  });

  it("pairing mode rejects unapproved and returns pairing code", async () => {
    const mgr = createPairingManager(storePath);
    const enforcer = createDmPolicyEnforcer({
      dmPolicy: DmPolicy.PAIRING,
      pairingManager: mgr,
    });
    const result = await enforcer.shouldAllow("new-user", BotPlatform.TELEGRAM);
    expect(result.allowed).toBe(false);
    expect(result.pairingCode).toMatch(/^[A-Z0-9]{6}$/);
    const pending = await mgr.listPending();
    expect(pending.some((r) => r.code === result.pairingCode)).toBe(true);
  });

  it("pairing mode allows previously approved senders", async () => {
    const mgr = createPairingManager(storePath);
    const req = await mgr.createRequest(BotPlatform.TELEGRAM, "alice");
    expect(await mgr.approve(req.code)).not.toBeNull();
    const enforcer = createDmPolicyEnforcer({
      dmPolicy: DmPolicy.PAIRING,
      pairingManager: mgr,
    });
    expect(await enforcer.shouldAllow("alice", BotPlatform.TELEGRAM)).toEqual({
      allowed: true,
    });
  });
});
