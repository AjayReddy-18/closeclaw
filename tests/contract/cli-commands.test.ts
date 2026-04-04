import { describe, it, expect, vi, beforeEach } from "vitest";

const runOnboardMock = vi.hoisted(() => vi.fn());

vi.mock("../../packages/cli/src/commands/onboard.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../packages/cli/src/commands/onboard.js")
  >("../../packages/cli/src/commands/onboard.js");
  return { ...actual, runOnboard: runOnboardMock };
});

describe("closeclaw onboard exit codes", () => {
  beforeEach(() => {
    runOnboardMock.mockReset();
  });

  it("returns exit code 0 when onboard succeeds", async () => {
    runOnboardMock.mockResolvedValue(undefined);
    const { runCli } = await import("../../packages/cli/src/cli.js");
    const code = await runCli(["node", "closeclaw", "onboard"]);
    expect(code).toBe(0);
    expect(runOnboardMock).toHaveBeenCalledTimes(1);
  });

  it("returns exit code 1 when onboard fails", async () => {
    runOnboardMock.mockRejectedValue(new Error("failed"));
    const { runCli } = await import("../../packages/cli/src/cli.js");
    const code = await runCli(["node", "closeclaw", "onboard"]);
    expect(code).toBe(1);
  });
});
