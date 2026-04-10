import { createRequire } from "node:module";
import { CURSOR_AGENT_BINARY } from "./types.js";

const require = createRequire(import.meta.url);

export type ExecWhich = (binary: string) => Promise<boolean>;

export interface AvailabilityResult {
  agentInstalled: boolean;
  ptyAvailable: boolean;
  available: boolean;
}

async function checkBinary(exec: ExecWhich, binary: string): Promise<boolean> {
  try {
    return await exec(binary);
  } catch {
    return false;
  }
}

function checkPtyLoadable(): boolean {
  try {
    require.resolve("node-pty");
    return true;
  } catch {
    return false;
  }
}

export async function checkCursorAvailability(
  exec: ExecWhich,
  isPtyAvailable: () => boolean = checkPtyLoadable,
): Promise<AvailabilityResult> {
  try {
    const agentInstalled = await checkBinary(exec, CURSOR_AGENT_BINARY);
    const ptyAvailable = isPtyAvailable();
    return {
      agentInstalled,
      ptyAvailable,
      available: agentInstalled,
    };
  } catch {
    return {
      agentInstalled: false,
      ptyAvailable: false,
      available: false,
    };
  }
}
