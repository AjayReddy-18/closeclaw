import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  BotPlatform,
  PairingStatus,
} from "@closeclaw/shared-types";
import { runPairingApprove } from "../../../packages/cli/src/commands/pairing-approve.js";

describe("runPairingApprove", () => {
  let dir: string;
  let storePath: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = join(tmpdir(), `closeclaw-papp-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    storePath = join(dir, "pairing.json");
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  it("approves valid code and prints success", async () => {
    writeFileSync(
      storePath,
      JSON.stringify({
        requests: [
          {
            code: "XY9Z01",
            senderPlatform: BotPlatform.DISCORD,
            senderId: "42",
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
            status: PairingStatus.PENDING,
          },
        ],
        approvedSenders: [],
      }),
      "utf-8",
    );
    await runPairingApprove("XY9Z01", { storePath });
    expect(
      logSpy.mock.calls.some((c) => String(c[0]).toLowerCase().includes("success")),
    ).toBe(true);
    const raw = JSON.parse(readFileSync(storePath, "utf-8")) as {
      approvedSenders: { senderId: string }[];
    };
    expect(raw.approvedSenders.some((a) => a.senderId === "42")).toBe(true);
  });

  it("rejects expired code", async () => {
    writeFileSync(
      storePath,
      JSON.stringify({
        requests: [
          {
            code: "OLD123",
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
    await runPairingApprove("OLD123", { storePath });
    expect(
      logSpy.mock.calls.some((c) =>
        String(c[0]).toLowerCase().includes("fail"),
      ),
    ).toBe(true);
  });

  it("rejects unknown code", async () => {
    writeFileSync(
      storePath,
      JSON.stringify({ requests: [], approvedSenders: [] }),
      "utf-8",
    );
    await runPairingApprove("ZZZZZZ", { storePath });
    expect(
      logSpy.mock.calls.some((c) =>
        String(c[0]).toLowerCase().includes("fail"),
      ),
    ).toBe(true);
  });
});
