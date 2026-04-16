import { describe, it, expect, vi } from "vitest";

describe("ProgressReporter", () => {
  async function loadModule() {
    return import("../../../packages/workflow/src/progress-reporter.js");
  }

  it("formats step progress message", async () => {
    const { createProgressReporter } = await loadModule();
    const onProgress = vi.fn();
    const reporter = createProgressReporter(3, onProgress);
    reporter.reportStepStart("step-1", "Fetch data");
    expect(onProgress).toHaveBeenCalledWith(
      "[Step 1/3: Fetch data] Running...",
    );
  });

  it("increments step counter", async () => {
    const { createProgressReporter } = await loadModule();
    const onProgress = vi.fn();
    const reporter = createProgressReporter(3, onProgress);
    reporter.reportStepStart("s1", "First");
    reporter.reportStepStart("s2", "Second");
    expect(onProgress).toHaveBeenLastCalledWith(
      "[Step 2/3: Second] Running...",
    );
  });

  it("reports step completion", async () => {
    const { createProgressReporter } = await loadModule();
    const onProgress = vi.fn();
    const reporter = createProgressReporter(2, onProgress);
    reporter.reportStepStart("s1", "Check");
    reporter.reportStepComplete("s1", "success");
    expect(onProgress).toHaveBeenLastCalledWith("[Step 1/2: Check] Done");
  });

  it("reports step failure", async () => {
    const { createProgressReporter } = await loadModule();
    const onProgress = vi.fn();
    const reporter = createProgressReporter(2, onProgress);
    reporter.reportStepStart("s1", "Deploy");
    reporter.reportStepComplete("s1", "failed");
    expect(onProgress).toHaveBeenLastCalledWith("[Step 1/2: Deploy] Failed");
  });

  it("builds finalize summary", async () => {
    const { createProgressReporter } = await loadModule();
    const onProgress = vi.fn();
    const reporter = createProgressReporter(2, onProgress);
    reporter.reportStepStart("s1", "First");
    reporter.reportStepComplete("s1", "success");
    reporter.reportStepStart("s2", "Second");
    reporter.reportStepComplete("s2", "success");
    const summary = reporter.buildSummary("completed");
    expect(summary).toContain("completed");
    expect(summary).toContain("2");
  });

  it("includes failure info in summary", async () => {
    const { createProgressReporter } = await loadModule();
    const onProgress = vi.fn();
    const reporter = createProgressReporter(2, onProgress);
    reporter.reportStepStart("s1", "Bad Step");
    reporter.reportStepComplete("s1", "failed");
    const summary = reporter.buildSummary("failed");
    expect(summary).toContain("failed");
  });

  it("ignores reportStepComplete for unknown stepId", async () => {
    const { createProgressReporter } = await loadModule();
    const onProgress = vi.fn();
    const reporter = createProgressReporter(2, onProgress);
    reporter.reportStepComplete("unknown-id", "success");
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("falls back to raw outcome when status label is unknown", async () => {
    const { createProgressReporter } = await loadModule();
    const onProgress = vi.fn();
    const reporter = createProgressReporter(1, onProgress);
    reporter.reportStepStart("s1", "Test");
    reporter.reportStepComplete("s1", "custom-status" as "success");
    expect(onProgress).toHaveBeenLastCalledWith(
      "[Step 1/1: Test] custom-status",
    );
  });
});
