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

function isEacces(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EACCES"
  );
}

function formatWriteFailure(
  label: string,
  target: string,
  error: unknown,
): string {
  if (isEacces(error)) {
    return `${label}: Permission denied — cannot access ${target}`;
  }
  return `${label}: ${target}`;
}

export function writeConfig(filePath: string, config: Configuration): void {
  const dir = dirname(filePath);
  ensureDirectory(dir);

  const tmpPath = `${filePath}.tmp`;
  const json = JSON.stringify(config, null, 2);

  try {
    writeFileSync(tmpPath, json, "utf-8");
    renameSync(tmpPath, filePath);
  } catch (error: unknown) {
    throw new ConfigWriteError(
      formatWriteFailure("Failed to write config", filePath, error),
      error,
    );
  }
}

function ensureDirectory(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true });
  } catch (error: unknown) {
    throw new ConfigWriteError(
      formatWriteFailure("Failed to create config directory", dir, error),
      error,
    );
  }
}
