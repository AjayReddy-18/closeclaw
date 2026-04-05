import { describe, it, expect } from "vitest";
import {
  PairingStatus,
  isPairingStatus,
  isValidPairingRequest,
  isValidPairingStore,
} from "@closeclaw/shared-types";

describe("PairingStatus", () => {
  it("defines pending, approved, and expired values", () => {
    expect(PairingStatus.PENDING).toBe("pending");
    expect(PairingStatus.APPROVED).toBe("approved");
    expect(PairingStatus.EXPIRED).toBe("expired");
  });

  it("validates known statuses", () => {
    expect(isPairingStatus("pending")).toBe(true);
    expect(isPairingStatus("approved")).toBe(true);
    expect(isPairingStatus("expired")).toBe(true);
  });

  it("rejects unknown statuses", () => {
    expect(isPairingStatus("denied")).toBe(false);
    expect(isPairingStatus("")).toBe(false);
    expect(isPairingStatus(null)).toBe(false);
  });
});

describe("isValidPairingRequest", () => {
  const validRequest = {
    code: "A7X3K2",
    senderPlatform: "telegram",
    senderId: "123456789",
    createdAt: "2026-04-05T14:30:00Z",
    expiresAt: "2026-04-05T15:30:00Z",
    status: "pending",
  };

  it("validates a correct pairing request", () => {
    expect(isValidPairingRequest(validRequest)).toBe(true);
  });

  it("validates request with optional displayName", () => {
    expect(
      isValidPairingRequest({
        ...validRequest,
        senderDisplayName: "@alice",
      }),
    ).toBe(true);
  });

  it("rejects null", () => {
    expect(isValidPairingRequest(null)).toBe(false);
  });

  it("rejects invalid pairing code format", () => {
    expect(isValidPairingRequest({ ...validRequest, code: "abc" })).toBe(false);
  });

  it("rejects lowercase pairing code", () => {
    expect(isValidPairingRequest({ ...validRequest, code: "a7x3k2" })).toBe(
      false,
    );
  });

  it("rejects invalid platform", () => {
    expect(
      isValidPairingRequest({ ...validRequest, senderPlatform: "slack" }),
    ).toBe(false);
  });

  it("rejects empty senderId", () => {
    expect(isValidPairingRequest({ ...validRequest, senderId: "" })).toBe(
      false,
    );
  });

  it("rejects invalid createdAt date", () => {
    expect(isValidPairingRequest({ ...validRequest, createdAt: "bad" })).toBe(
      false,
    );
  });

  it("rejects invalid expiresAt date", () => {
    expect(isValidPairingRequest({ ...validRequest, expiresAt: "bad" })).toBe(
      false,
    );
  });

  it("rejects invalid status", () => {
    expect(isValidPairingRequest({ ...validRequest, status: "denied" })).toBe(
      false,
    );
  });
});

describe("isValidPairingStore", () => {
  const validStore = {
    requests: [],
    approvedSenders: [],
  };

  it("validates an empty pairing store", () => {
    expect(isValidPairingStore(validStore)).toBe(true);
  });

  it("validates store with requests and approved senders", () => {
    expect(
      isValidPairingStore({
        requests: [
          {
            code: "A7X3K2",
            senderPlatform: "telegram",
            senderId: "123456789",
            createdAt: "2026-04-05T14:30:00Z",
            expiresAt: "2026-04-05T15:30:00Z",
            status: "pending",
          },
        ],
        approvedSenders: [
          {
            platform: "telegram",
            senderId: "123456789",
            approvedAt: "2026-04-05T14:30:00Z",
          },
        ],
      }),
    ).toBe(true);
  });

  it("rejects null", () => {
    expect(isValidPairingStore(null)).toBe(false);
  });

  it("rejects non-array requests", () => {
    expect(isValidPairingStore({ requests: "bad", approvedSenders: [] })).toBe(
      false,
    );
  });

  it("rejects invalid request in store", () => {
    expect(
      isValidPairingStore({
        requests: [{ code: "bad" }],
        approvedSenders: [],
      }),
    ).toBe(false);
  });
});
