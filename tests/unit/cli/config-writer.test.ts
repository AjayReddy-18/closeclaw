import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { Configuration } from "@closeclaw/shared-types";
import { writeConfig } from "../../../packages/cli/src/config/config-writer.js";

describe("writeConfig", () => {
  let testDir: string;
  let configPath: string;

  const validConfig: Configuration = {
    version: "1.0.0",
    lastModified: "2026-04-05T14:30:00Z",
    channels: {
      telegram: {
        platform: "telegram",
        botToken: "123456:ABC-DEF",
        enabled: true,
        dmPolicy: "pairing",
        createdAt: "2026-04-05T14:30:00Z",
      },
    },
    gateway: {
      bindAddress: "127.0.0.1",
      port: 18790,
      authToken: "a".repeat(64),
    },
  };

  beforeEach(() => {
    testDir = join(tmpdir(), `closeclaw-test-${randomUUID()}`);
    configPath = join(testDir, "closeclaw.json");
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("creates the directory and writes config", () => {
    writeConfig(configPath, validConfig);
    expect(existsSync(configPath)).toBe(true);
  });

  it("writes valid JSON with 2-space indentation", () => {
    writeConfig(configPath, validConfig);
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed).toEqual(validConfig);
    expect(raw).toContain("  ");
  });

  it("does not leave .tmp file after successful write", () => {
    writeConfig(configPath, validConfig);
    expect(existsSync(`${configPath}.tmp`)).toBe(false);
  });

  it("overwrites existing config", () => {
    writeConfig(configPath, validConfig);
    const updatedConfig: Configuration = {
      ...validConfig,
      version: "1.1.0",
    };
    writeConfig(configPath, updatedConfig);
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe("1.1.0");
  });
});
