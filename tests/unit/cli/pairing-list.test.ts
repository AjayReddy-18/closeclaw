import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { BotPlatform, PairingStatus } from "@closeclaw/shared-types";
import { runPairingList } from "../../../packages/cli/src/commands/pairing-list.js";

describe("runPairingList", () => {
  let dir: string;
  let storePath: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = join(tmpdir(), `closeclaw-plist-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    storePath = join(dir, "pairing.json");
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  it("prints table of pending requests", async () => {
    writeFileSync(
      storePath,
      JSON.stringify({
        requests: [
          {
            code: "AB12CD",
            senderPlatform: BotPlatform.TELEGRAM,
            senderId: "99",
            senderDisplayName: "Pat",
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
    expect(logSpy).toHaveBeenCalled();
    const combined = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(combined).toContain("AB12CD");
    expect(combined).toContain("99");
    expect(combined).toContain("telegram");
  });

  it("shows no pending message when empty", async () => {
    writeFileSync(
      storePath,
      JSON.stringify({ requests: [], approvedSenders: [] }),
      "utf-8",
    );
    await runPairingList({ storePath });
    expect(
      logSpy.mock.calls.some((c) => String(c[0]).includes("No pending")),
    ).toBe(true);
  });
});
