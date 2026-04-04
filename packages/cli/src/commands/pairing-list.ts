import { createPairingManager } from "@closeclaw/gateway";

export async function runPairingList(deps: {
  storePath: string;
}): Promise<void> {
  const mgr = createPairingManager(deps.storePath);
  await mgr.expireStale();
  const rows = await mgr.listPending();
  if (rows.length === 0) {
    console.log("No pending pairing requests.");
    return;
  }
  const header = ["Code", "Platform", "Sender", "Name", "Expires"].join("\t");
  console.log(header);
  for (const r of rows) {
    const line = [
      r.code,
      r.senderPlatform,
      r.senderId,
      r.senderDisplayName ?? "",
      r.expiresAt,
    ].join("\t");
    console.log(line);
  }
}
