export declare const DmPolicy: {
  readonly PAIRING: "pairing";
  readonly ALLOWLIST: "allowlist";
  readonly OPEN: "open";
};
export type DmPolicy = (typeof DmPolicy)[keyof typeof DmPolicy];
export declare const DM_POLICIES: readonly DmPolicy[];
export declare function isDmPolicy(value: unknown): value is DmPolicy;
//# sourceMappingURL=dm-policy.d.ts.map
