export const DmPolicy = {
  PAIRING: "pairing",
  ALLOWLIST: "allowlist",
  OPEN: "open",
} as const;

export type DmPolicy = (typeof DmPolicy)[keyof typeof DmPolicy];

export const DM_POLICIES: readonly DmPolicy[] = [
  DmPolicy.PAIRING,
  DmPolicy.ALLOWLIST,
  DmPolicy.OPEN,
];

export function isDmPolicy(value: unknown): value is DmPolicy {
  return typeof value === "string" && DM_POLICIES.includes(value as DmPolicy);
}
