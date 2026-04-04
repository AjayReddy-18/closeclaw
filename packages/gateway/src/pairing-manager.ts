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

const CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomCode(): string {
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length]!;
  }
  return code;
}

function emptyStore(): PairingStore {
  return { requests: [], approvedSenders: [] };
}

function isEnoent(e: unknown): boolean {
  return (
    e instanceof Error &&
    "code" in e &&
    (e as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function readStoreFile(path: string): PairingStore {
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

function writeStoreAtomic(path: string, store: PairingStore): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, "utf-8");
  renameSync(tmp, path);
}

function findActivePending(
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

function pickUniqueCode(store: PairingStore): string {
  for (let i = 0; i < 80; i++) {
    const code = randomCode();
    if (!store.requests.some((r) => r.code === code)) return code;
  }
  return randomCode();
}

function buildPendingRequest(
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

function appendPendingRequest(
  store: PairingStore,
  platform: BotPlatform,
  senderId: string,
  displayName: string | undefined,
  now: number,
): PairingRequest {
  const code = pickUniqueCode(store);
  const req = buildPendingRequest(
    code,
    platform,
    senderId,
    displayName,
    now,
  );
  store.requests.push(req);
  return req;
}

function findApprovableRequest(
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

function toApprovedSender(req: PairingRequest): ApprovedSender {
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

export type PairingManager = {
  createRequest(
    platform: BotPlatform,
    senderId: string,
    displayName?: string,
  ): Promise<PairingRequest>;
  listPending(): Promise<PairingRequest[]>;
  approve(code: string): Promise<ApprovedSender | null>;
  expireStale(): Promise<number>;
  isSenderApproved(
    platform: BotPlatform,
    senderId: string,
  ): Promise<boolean>;
};

export function createPairingManager(storePath: string): PairingManager {
  let chain: Promise<unknown> = Promise.resolve();
  const run = <T>(fn: () => T): Promise<T> => {
    const next = chain.then(() => fn());
    chain = next.then(() => undefined).catch(() => undefined);
    return next;
  };

  return {
    createRequest(platform, senderId, displayName) {
      return run(() => {
        const store = readStoreFile(storePath);
        const now = Date.now();
        const existing = findActivePending(store, platform, senderId, now);
        if (existing) return existing;
        const req = appendPendingRequest(
          store,
          platform,
          senderId,
          displayName,
          now,
        );
        writeStoreAtomic(storePath, store);
        return req;
      });
    },
    listPending() {
      return run(() => {
        const store = readStoreFile(storePath);
        const now = Date.now();
        return store.requests.filter(
          (r) =>
            r.status === PairingStatus.PENDING &&
            new Date(r.expiresAt).getTime() > now,
        );
      });
    },
    approve(code) {
      return run(() => {
        const store = readStoreFile(storePath);
        const upper = code.toUpperCase();
        const now = Date.now();
        const req = findApprovableRequest(store, upper, now);
        if (!req) return null;
        req.status = PairingStatus.APPROVED;
        const row = toApprovedSender(req);
        store.approvedSenders.push(row);
        writeStoreAtomic(storePath, store);
        return row;
      });
    },
    expireStale() {
      return run(() => {
        const store = readStoreFile(storePath);
        const now = Date.now();
        let n = 0;
        for (const r of store.requests) {
          if (
            r.status === PairingStatus.PENDING &&
            new Date(r.expiresAt).getTime() <= now
          ) {
            r.status = PairingStatus.EXPIRED;
            n++;
          }
        }
        if (n > 0) writeStoreAtomic(storePath, store);
        return n;
      });
    },
    isSenderApproved(platform, senderId) {
      return run(() => {
        const store = readStoreFile(storePath);
        return store.approvedSenders.some(
          (a) => a.platform === platform && a.senderId === senderId,
        );
      });
    },
  };
}
