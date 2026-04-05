import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { Configuration } from "@closeclaw/shared-types";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    mkdirSync: vi.fn(
      (
        path: Parameters<typeof actual.mkdirSync>[0],
        options?: Parameters<typeof actual.mkdirSync>[1],
      ) => actual.mkdirSync(path, options),
    ),
  };
});

import * as fs from "node:fs";
import {
  writeConfig,
  ConfigWriteError,
} from "../../../packages/cli/src/config/config-writer.js";

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
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("creates the directory and writes config", () => {
    writeConfig(configPath, validConfig);
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it("writes valid JSON with 2-space indentation", () => {
    writeConfig(configPath, validConfig);
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed).toEqual(validConfig);
    expect(raw).toContain("  ");
  });

  it("does not leave .tmp file after successful write", () => {
    writeConfig(configPath, validConfig);
    expect(fs.existsSync(`${configPath}.tmp`)).toBe(false);
  });

  it("overwrites existing config", () => {
    writeConfig(configPath, validConfig);
    const updatedConfig: Configuration = {
      ...validConfig,
      version: "1.1.0",
    };
    writeConfig(configPath, updatedConfig);
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe("1.1.0");
  });

  it("includes Permission denied when mkdir fails with EACCES", () => {
    vi.mocked(fs.mkdirSync).mockImplementationOnce(() => {
      const err = new Error("mock") as NodeJS.ErrnoException;
      err.code = "EACCES";
      throw err;
    });
    let caught: unknown;
    try {
      writeConfig(configPath, validConfig);
    } catch (e: unknown) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConfigWriteError);
    expect((caught as ConfigWriteError).message).toContain("Permission denied");
  });

  it("throws ConfigWriteError when writeFileSync fails with EACCES", () => {
    writeConfig(configPath, validConfig);
    const origWrite = fs.writeFileSync;
    vi.spyOn(fs, "writeFileSync").mockImplementationOnce(() => {
      const err = new Error("nope") as NodeJS.ErrnoException;
      err.code = "EACCES";
      throw err;
    });
    let caught: unknown;
    try {
      writeConfig(configPath, validConfig);
    } catch (e: unknown) {
      caught = e;
    }
    vi.mocked(fs.writeFileSync).mockImplementation(origWrite);
    expect(caught).toBeInstanceOf(ConfigWriteError);
    expect((caught as ConfigWriteError).message).toContain("Permission denied");
  });

  it("throws ConfigWriteError without Permission denied for non-EACCES write error", () => {
    writeConfig(configPath, validConfig);
    vi.spyOn(fs, "writeFileSync").mockImplementationOnce(() => {
      throw new Error("disk full");
    });
    let caught: unknown;
    try {
      writeConfig(configPath, validConfig);
    } catch (e: unknown) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConfigWriteError);
    expect((caught as ConfigWriteError).message).toContain(
      "Failed to write config",
    );
    expect((caught as ConfigWriteError).message).not.toContain(
      "Permission denied",
    );
  });
});
