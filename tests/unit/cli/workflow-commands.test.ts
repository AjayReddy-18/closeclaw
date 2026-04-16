import { describe, it, expect, vi, beforeEach } from "vitest";
import { runWorkflowList } from "../../../packages/cli/src/commands/workflow-list.js";
import { runWorkflowInspect } from "../../../packages/cli/src/commands/workflow-inspect.js";
import { runWorkflowEnable } from "../../../packages/cli/src/commands/workflow-enable.js";
import { runWorkflowDisable } from "../../../packages/cli/src/commands/workflow-disable.js";
import { runWorkflowDelete } from "../../../packages/cli/src/commands/workflow-delete.js";
import { runWorkflowHistory } from "../../../packages/cli/src/commands/workflow-history.js";
import type { WorkflowStore } from "@closeclaw/workflow";

function makeStore(): WorkflowStore {
  return {
    getWorkflow: vi.fn(),
    saveWorkflow: vi.fn(),
    listWorkflows: vi.fn(() => []),
    listAll: vi.fn(() => []),
    updateWorkflow: vi.fn(),
    deleteWorkflow: vi.fn(() => true),
    addExecution: vi.fn(),
    getExecutions: vi.fn(() => []),
  };
}

const SAMPLE_WF = {
  id: "wf-abc12345",
  name: "Daily CI Check",
  description: "Runs CI every morning",
  ownerPlatform: "telegram" as const,
  ownerSenderId: "42",
  trigger: { type: "cron" as const, value: "0 9 * * *" },
  steps: [
    {
      type: "action" as const,
      id: "s1",
      label: "Run tests",
      prompt: "run tests",
    },
  ],
  status: "active" as const,
  createdAt: "2026-03-01T09:00:00Z",
  updatedAt: "2026-03-15T10:00:00Z",
  lastRunAt: "2026-04-01T09:00:00Z",
  runCount: 12,
};

let consoleSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("workflow list", () => {
  it("shows empty message when no workflows", () => {
    runWorkflowList(makeStore());
    expect(consoleSpy).toHaveBeenCalledWith("No workflows defined.");
  });

  it("lists workflows in table format", () => {
    const store = makeStore();
    store.listAll = vi.fn(() => [SAMPLE_WF]);
    runWorkflowList(store);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("wf-abc123"),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Daily CI Check"),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("1 workflow(s)"),
    );
  });
});

describe("workflow inspect", () => {
  it("shows error for missing workflow", () => {
    runWorkflowInspect(makeStore(), "missing");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
  });

  it("displays workflow details", () => {
    const store = makeStore();
    store.getWorkflow = vi.fn(() => SAMPLE_WF);
    store.getExecutions = vi.fn(() => []);
    runWorkflowInspect(store, "wf-abc12345");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Daily CI Check"),
    );
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("cron"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("12"));
  });

  it("displays recent executions when present", () => {
    const store = makeStore();
    store.getWorkflow = vi.fn(() => SAMPLE_WF);
    store.getExecutions = vi.fn(() => [
      {
        id: "exec-1",
        workflowId: "wf-abc12345",
        workflowName: "Daily CI Check",
        triggeredBy: "cron" as const,
        status: "completed" as const,
        startedAt: "2026-04-01T09:00:00Z",
        durationMs: 1500,
        stepResults: [],
      },
    ]);
    runWorkflowInspect(store, "wf-abc12345");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Recent executions"),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("completed"),
    );
  });
});

describe("workflow enable", () => {
  it("shows error for missing workflow", () => {
    runWorkflowEnable(makeStore(), "missing");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
  });

  it("enables a disabled workflow", () => {
    const store = makeStore();
    store.getWorkflow = vi.fn(() => ({
      ...SAMPLE_WF,
      status: "disabled" as const,
    }));
    runWorkflowEnable(store, "wf-abc12345");
    expect(store.updateWorkflow).toHaveBeenCalledWith("wf-abc12345", {
      status: "active",
    });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("enabled"));
  });

  it("skips if already active", () => {
    const store = makeStore();
    store.getWorkflow = vi.fn(() => SAMPLE_WF);
    runWorkflowEnable(store, "wf-abc12345");
    expect(store.updateWorkflow).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("already active"),
    );
  });
});

describe("workflow disable", () => {
  it("shows error for missing workflow", () => {
    runWorkflowDisable(makeStore(), "missing");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
  });

  it("disables an active workflow", () => {
    const store = makeStore();
    store.getWorkflow = vi.fn(() => SAMPLE_WF);
    runWorkflowDisable(store, "wf-abc12345");
    expect(store.updateWorkflow).toHaveBeenCalledWith("wf-abc12345", {
      status: "disabled",
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("disabled"),
    );
  });

  it("skips if already disabled", () => {
    const store = makeStore();
    store.getWorkflow = vi.fn(() => ({
      ...SAMPLE_WF,
      status: "disabled" as const,
    }));
    runWorkflowDisable(store, "wf-abc12345");
    expect(store.updateWorkflow).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("already disabled"),
    );
  });
});

describe("workflow delete", () => {
  it("deletes existing workflow", () => {
    const store = makeStore();
    runWorkflowDelete(store, "wf-abc12345");
    expect(store.deleteWorkflow).toHaveBeenCalledWith("wf-abc12345");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("deleted"));
  });

  it("shows error for missing workflow", () => {
    const store = makeStore();
    store.deleteWorkflow = vi.fn(() => false);
    runWorkflowDelete(store, "missing");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
  });
});

describe("workflow history", () => {
  it("shows error for missing workflow", () => {
    runWorkflowHistory(makeStore(), "missing");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
  });

  it("shows empty message when no executions", () => {
    const store = makeStore();
    store.getWorkflow = vi.fn(() => SAMPLE_WF);
    runWorkflowHistory(store, "wf-abc12345");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("No execution history"),
    );
  });

  it("shows execution history in table format", () => {
    const store = makeStore();
    store.getWorkflow = vi.fn(() => SAMPLE_WF);
    store.getExecutions = vi.fn(() => [
      {
        id: "exec-001234",
        workflowId: "wf-abc12345",
        workflowName: "Daily CI Check",
        triggeredBy: "cron" as const,
        status: "completed" as const,
        startedAt: "2026-04-01T09:00:00Z",
        durationMs: 2000,
        stepResults: [],
      },
    ]);
    runWorkflowHistory(store, "wf-abc12345");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("exec-0012"),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("1 execution(s)"),
    );
  });

  it("respects custom limit", () => {
    const store = makeStore();
    store.getWorkflow = vi.fn(() => SAMPLE_WF);
    store.getExecutions = vi.fn(() => []);
    runWorkflowHistory(store, "wf-abc12345", 5);
    expect(store.getExecutions).toHaveBeenCalledWith("wf-abc12345", 5);
  });
});
