import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { BotPlatform, PairingStatus } from "@closeclaw/shared-types";
import { isValidConfiguration } from "@closeclaw/shared-types";
import { runPairingList } from "../../packages/cli/src/commands/pairing-list.js";
import { runPairingApprove } from "../../packages/cli/src/commands/pairing-approve.js";

describe("pairing list and approve flow", () => {
  let dir: string;
  let storePath: string;
  let configPath: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = join(tmpdir(), `closeclaw-pflow-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    storePath = join(dir, "pairing.json");
    configPath = join(dir, "closeclaw.json");
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  it("lists pending then approve updates store", async () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        version: "0.1.0",
        lastModified: new Date().toISOString(),
        channels: {},
        gateway: {
          bindAddress: "127.0.0.1",
          port: 18790,
          authToken: "c".repeat(64),
        },
      }),
      "utf-8",
    );
    const loaded = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(isValidConfiguration(loaded)).toBe(true);

    writeFileSync(
      storePath,
      JSON.stringify({
        requests: [
          {
            code: "LIST01",
            senderPlatform: BotPlatform.TELEGRAM,
            senderId: "500",
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
            status: PairingStatus.PENDING,
          },
        ],
        approvedSenders: [],
      }),
      "utf-8",
    );

    await runPairingList({ storePath });
    expect(logSpy.mock.calls.length).toBeGreaterThan(0);

    await runPairingApprove("LIST01", { storePath });

    const raw = JSON.parse(readFileSync(storePath, "utf-8")) as {
      approvedSenders: { senderId: string }[];
      requests: { code: string; status: string }[];
    };
    expect(raw.approvedSenders.some((a) => a.senderId === "500")).toBe(true);
    const req = raw.requests.find((r) => r.code === "LIST01");
    expect(req?.status).toBe(PairingStatus.APPROVED);
  });
});
