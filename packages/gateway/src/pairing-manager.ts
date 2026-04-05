import {
  BotPlatform,
  PairingStatus,
  type ApprovedSender,
  type PairingRequest,
} from "@closeclaw/shared-types";
import {
  appendPendingRequest,
  findActivePending,
  findApprovableRequest,
  readStoreFile,
  toApprovedSender,
  writeStoreAtomic,
} from "./pairing-store.js";

export type PairingManager = {
  createRequest(
    platform: BotPlatform,
    senderId: string,
    displayName?: string,
  ): Promise<PairingRequest>;
  listPending(): Promise<PairingRequest[]>;
  approve(code: string): Promise<ApprovedSender | null>;
  expireStale(): Promise<number>;
  isSenderApproved(platform: BotPlatform, senderId: string): Promise<boolean>;
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
