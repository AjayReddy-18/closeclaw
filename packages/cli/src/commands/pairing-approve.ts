import { createPairingManager } from "@closeclaw/gateway";

export async function runPairingApprove(
  code: string,
  deps: { storePath: string },
): Promise<void> {
  const mgr = createPairingManager(deps.storePath);
  const normalized = code.trim().toUpperCase();
  const approved = await mgr.approve(normalized);
  if (approved) {
    console.log(
      `Success: approved ${approved.platform} sender ${approved.senderId}.`,
    );
    return;
  }
  console.log("Failed: invalid or expired pairing code.");
}
