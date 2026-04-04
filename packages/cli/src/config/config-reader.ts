import { readFileSync } from "node:fs";
import {
  isValidConfiguration,
  type Configuration,
} from "@closeclaw/shared-types";

export class ConfigReadError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ConfigReadError";
  }
}

export function readConfig(filePath: string): Configuration | null {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }
    throw new ConfigReadError(`Failed to read config: ${filePath}`, error);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConfigReadError(`Malformed JSON in config: ${filePath}`);
  }

  if (!isValidConfiguration(parsed)) {
    throw new ConfigReadError(`Invalid configuration schema: ${filePath}`);
  }

  return parsed;
}

function isNodeError(
  error: unknown,
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
