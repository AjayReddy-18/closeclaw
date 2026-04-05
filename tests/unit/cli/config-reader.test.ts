import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  readConfig,
  ConfigReadError,
} from "../../../packages/cli/src/config/config-reader.js";

describe("readConfig", () => {
  let testDir: string;
  let configPath: string;

  const validConfig = {
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
    mkdirSync(testDir, { recursive: true });
    configPath = join(testDir, "closeclaw.json");
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("returns null when file does not exist", () => {
    expect(readConfig(configPath)).toBeNull();
  });

  it("reads and parses valid config", () => {
    writeFileSync(configPath, JSON.stringify(validConfig));
    const result = readConfig(configPath);
    expect(result).toEqual(validConfig);
  });

  it("throws ConfigReadError on malformed JSON", () => {
    writeFileSync(configPath, "not-json{{{");
    expect(() => readConfig(configPath)).toThrow(ConfigReadError);
    expect(() => readConfig(configPath)).toThrow("Malformed JSON");
  });

  it("throws ConfigReadError on invalid schema", () => {
    writeFileSync(configPath, JSON.stringify({ version: "bad" }));
    expect(() => readConfig(configPath)).toThrow(ConfigReadError);
    expect(() => readConfig(configPath)).toThrow(
      "Invalid configuration schema",
    );
  });

  it("throws ConfigReadError for non-ENOENT read failures", () => {
    mkdirSync(configPath, { recursive: true });
    expect(() => readConfig(configPath)).toThrow(ConfigReadError);
    expect(() => readConfig(configPath)).toThrow("Failed to read config");
  });
});
