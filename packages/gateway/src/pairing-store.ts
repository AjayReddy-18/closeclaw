import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import {
  BotPlatform,
  PairingStatus,
  type ApprovedSender,
  type PairingRequest,
  type PairingStore,
  isValidPairingStore,
} from "@closeclaw/shared-types";

export const CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function randomCode(): string {
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length]!;
  }
  return code;
}

export function emptyStore(): PairingStore {
  return { requests: [], approvedSenders: [] };
}

export function isEnoent(e: unknown): boolean {
  return (
    e instanceof Error &&
    "code" in e &&
    (e as NodeJS.ErrnoException).code === "ENOENT"
  );
}

export function readStoreFile(path: string): PairingStore {
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (!isValidPairingStore(parsed)) {
      throw new Error("invalid pairing store");
    }
    return parsed;
  } catch (e: unknown) {
    if (isEnoent(e)) return emptyStore();
    throw e;
  }
}

export function writeStoreAtomic(path: string, store: PairingStore): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, "utf-8");
  renameSync(tmp, path);
}

export function findActivePending(
  store: PairingStore,
  platform: BotPlatform,
  senderId: string,
  now: number,
): PairingRequest | undefined {
  return store.requests.find(
    (r) =>
      r.status === PairingStatus.PENDING &&
      r.senderPlatform === platform &&
      r.senderId === senderId &&
      new Date(r.expiresAt).getTime() > now,
  );
}

export function pickUniqueCode(store: PairingStore): string {
  for (let i = 0; i < 80; i++) {
    const code = randomCode();
    if (!store.requests.some((r) => r.code === code)) return code;
  }
  return randomCode();
}

export function buildPendingRequest(
  code: string,
  platform: BotPlatform,
  senderId: string,
  displayName: string | undefined,
  now: number,
): PairingRequest {
  const req: PairingRequest = {
    code,
    senderPlatform: platform,
    senderId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 60 * 60 * 1000).toISOString(),
    status: PairingStatus.PENDING,
  };
  if (displayName !== undefined) {
    req.senderDisplayName = displayName;
  }
  return req;
}

export function appendPendingRequest(
  store: PairingStore,
  platform: BotPlatform,
  senderId: string,
  displayName: string | undefined,
  now: number,
): PairingRequest {
  const code = pickUniqueCode(store);
  const req = buildPendingRequest(code, platform, senderId, displayName, now);
  store.requests.push(req);
  return req;
}

export function findApprovableRequest(
  store: PairingStore,
  upper: string,
  now: number,
): PairingRequest | undefined {
  return store.requests.find(
    (r) =>
      r.code === upper &&
      r.status === PairingStatus.PENDING &&
      new Date(r.expiresAt).getTime() > now,
  );
}

export function toApprovedSender(req: PairingRequest): ApprovedSender {
  const approvedAt = new Date().toISOString();
  const row: ApprovedSender = {
    platform: req.senderPlatform,
    senderId: req.senderId,
    approvedAt,
  };
  if (req.senderDisplayName !== undefined) {
    row.displayName = req.senderDisplayName;
  }
  return row;
}
