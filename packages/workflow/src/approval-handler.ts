import type { ApprovalCallback, ApprovalDecision } from "./types.js";

export async function requestApproval(
  prompt: string,
  callback: ApprovalCallback,
): Promise<ApprovalDecision> {
  try {
    return await callback(prompt);
  } catch {
    return "denied";
  }
}
