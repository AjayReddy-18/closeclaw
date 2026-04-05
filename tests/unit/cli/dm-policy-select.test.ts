import { describe, it, expect, vi, beforeEach } from "vitest";
import { select } from "@inquirer/prompts";
import { DmPolicy } from "@closeclaw/shared-types";

describe("selectDmPolicy", () => {
  beforeEach(() => {
    vi.mocked(select).mockReset();
  });

  it("returns selected policy and passes expected choice values", async () => {
    vi.mocked(select).mockResolvedValueOnce(DmPolicy.OPEN);
    const { selectDmPolicy } =
      await import("../../../packages/cli/src/prompts/dm-policy-select.js");
    const result = await selectDmPolicy();
    expect(result).toBe(DmPolicy.OPEN);
    expect(select).toHaveBeenCalledTimes(1);
    const row = vi.mocked(select).mock.calls[0];
    expect(row).toBeDefined();
    const opts = row![0];
    expect(opts).toBeDefined();
    const arg = opts as unknown as {
      choices: { value: string }[];
    };
    const values = arg.choices.map((c) => c.value);
    expect(values).toContain(DmPolicy.PAIRING);
    expect(values).toContain(DmPolicy.ALLOWLIST);
    expect(values).toContain(DmPolicy.OPEN);
  });
});
