export type ExecWhich = (binary: string) => Promise<boolean>;

export interface AvailabilityResult {
  agentInstalled: boolean;
  tmuxInstalled: boolean;
  available: boolean;
}

async function checkBinary(
  exec: ExecWhich,
  binary: string,
): Promise<boolean> {
  try {
    return await exec(binary);
  } catch {
    return false;
  }
}

export async function checkCursorAvailability(
  exec: ExecWhich,
): Promise<AvailabilityResult> {
  try {
    const [agentInstalled, tmuxInstalled] = await Promise.all([
      checkBinary(exec, "agent"),
      checkBinary(exec, "tmux"),
    ]);
    return {
      agentInstalled,
      tmuxInstalled,
      available: agentInstalled && tmuxInstalled,
    };
  } catch {
    return { agentInstalled: false, tmuxInstalled: false, available: false };
  }
}
