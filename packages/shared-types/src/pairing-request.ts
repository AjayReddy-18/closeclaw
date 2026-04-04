import type { BotPlatform } from "./bot-platform.js";
import { isBotPlatform } from "./bot-platform.js";

export const PairingStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  EXPIRED: "expired",
} as const;

export type PairingStatus =
  (typeof PairingStatus)[keyof typeof PairingStatus];

export function isPairingStatus(value: unknown): value is PairingStatus {
  return (
    typeof value === "string" &&
    Object.values(PairingStatus).includes(value as PairingStatus)
  );
}

export interface PairingRequest {
  code: string;
  senderPlatform: BotPlatform;
  senderId: string;
  senderDisplayName?: string;
  createdAt: string;
  expiresAt: string;
  status: PairingStatus;
}

export interface ApprovedSender {
  platform: BotPlatform;
  senderId: string;
  displayName?: string;
  approvedAt: string;
}

export interface PairingStore {
  requests: PairingRequest[];
  approvedSenders: ApprovedSender[];
}

const PAIRING_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export function isValidPairingRequest(
  value: unknown,
): value is PairingRequest {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  if (typeof obj["code"] !== "string") return false;
  if (!PAIRING_CODE_PATTERN.test(obj["code"])) return false;

  if (!isBotPlatform(obj["senderPlatform"])) return false;
  if (typeof obj["senderId"] !== "string" || obj["senderId"].length === 0) {
    return false;
  }

  if (typeof obj["createdAt"] !== "string") return false;
  if (isNaN(new Date(obj["createdAt"]).getTime())) return false;

  if (typeof obj["expiresAt"] !== "string") return false;
  if (isNaN(new Date(obj["expiresAt"]).getTime())) return false;

  if (!isPairingStatus(obj["status"])) return false;

  return true;
}

export function isValidPairingStore(
  value: unknown,
): value is PairingStore {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  if (!Array.isArray(obj["requests"])) return false;
  if (!Array.isArray(obj["approvedSenders"])) return false;

  for (const request of obj["requests"]) {
    if (!isValidPairingRequest(request)) return false;
  }

  return true;
}
