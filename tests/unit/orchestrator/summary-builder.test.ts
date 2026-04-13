import { describe, it, expect } from "vitest";

describe("buildOrchestrationSummary", () => {
  async function loadModule() {
    return import("../../../packages/orchestrator/src/summary-builder.js");
  }

  it("formats all-success results", async () => {
    const { buildOrchestrationSummary } = await loadModule();
    const results = [
      {
        id: "1",
        label: "Fetch Jira",
        status: "fulfilled" as const,
        response: "Found 5 issues",
      },
      {
        id: "2",
        label: "Check build",
        status: "fulfilled" as const,
        response: "Build passed",
      },
    ];
    const summary = buildOrchestrationSummary(results);
    expect(summary).toContain("Fetch Jira");
    expect(summary).toContain("Check build");
    expect(summary).toContain("Found 5 issues");
    expect(summary).toContain("Build passed");
  });

  it("formats mixed success and failure results", async () => {
    const { buildOrchestrationSummary } = await loadModule();
    const results = [
      {
        id: "1",
        label: "Fetch data",
        status: "fulfilled" as const,
        response: "Data retrieved",
      },
      {
        id: "2",
        label: "Run tests",
        status: "rejected" as const,
        error: "Connection timeout",
      },
    ];
    const summary = buildOrchestrationSummary(results);
    expect(summary).toContain("Data retrieved");
    expect(summary).toContain("Connection timeout");
  });

  it("formats all-failure results", async () => {
    const { buildOrchestrationSummary } = await loadModule();
    const results = [
      {
        id: "1",
        label: "Task A",
        status: "rejected" as const,
        error: "Error A",
      },
      {
        id: "2",
        label: "Task B",
        status: "rejected" as const,
        error: "Error B",
      },
    ];
    const summary = buildOrchestrationSummary(results);
    expect(summary).toContain("Error A");
    expect(summary).toContain("Error B");
  });

  it("handles empty results", async () => {
    const { buildOrchestrationSummary } = await loadModule();
    const summary = buildOrchestrationSummary([]);
    expect(summary).toBeTruthy();
  });

  it("truncates very long response text", async () => {
    const { buildOrchestrationSummary } = await loadModule();
    const longText = "x".repeat(1000);
    const results = [
      {
        id: "1",
        label: "Long task",
        status: "fulfilled" as const,
        response: longText,
      },
    ];
    const summary = buildOrchestrationSummary(results);
    expect(summary.length).toBeLessThan(longText.length);
  });
});
