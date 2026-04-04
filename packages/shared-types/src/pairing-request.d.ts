import type { BotPlatform } from "./bot-platform.js";
export declare const PairingStatus: {
    readonly PENDING: "pending";
    readonly APPROVED: "approved";
    readonly EXPIRED: "expired";
};
export type PairingStatus = (typeof PairingStatus)[keyof typeof PairingStatus];
export declare function isPairingStatus(value: unknown): value is PairingStatus;
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
export declare function isValidPairingRequest(value: unknown): value is PairingRequest;
export declare function isValidPairingStore(value: unknown): value is PairingStore;
//# sourceMappingURL=pairing-request.d.ts.map