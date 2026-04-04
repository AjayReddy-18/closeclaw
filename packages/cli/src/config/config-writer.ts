import { writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Configuration } from "@closeclaw/shared-types";

export class ConfigWriteError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ConfigWriteError";
  }
}

export function writeConfig(
  filePath: string,
  config: Configuration,
): void {
  const dir = dirname(filePath);
  ensureDirectory(dir);

  const tmpPath = `${filePath}.tmp`;
  const json = JSON.stringify(config, null, 2);

  try {
    writeFileSync(tmpPath, json, "utf-8");
    renameSync(tmpPath, filePath);
  } catch (error: unknown) {
    throw new ConfigWriteError(
      `Failed to write config: ${filePath}`,
      error,
    );
  }
}

function ensureDirectory(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true });
  } catch (error: unknown) {
    throw new ConfigWriteError(
      `Failed to create config directory: ${dir}`,
      error,
    );
  }
}
