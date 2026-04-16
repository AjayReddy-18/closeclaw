import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { WorkflowDefinition, ExecutionRecord } from "@closeclaw/workflow";

describe("WorkflowStore", () => {
  let baseDir: string;

  async function loadModule() {
    return import("../../../packages/workflow/src/workflow-store.js");
  }

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "wf-store-"));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  function makeDefinition(
    overrides?: Partial<WorkflowDefinition>,
  ): WorkflowDefinition {
    return {
      id: "wf-1",
      name: "test-workflow",
      ownerPlatform: "telegram",
      ownerSenderId: "user-1",
      trigger: { type: "cron", value: "0 9 * * *" },
      steps: [
        {
          id: "s1",
          type: "action",
          label: "Step 1",
          prompt: "Do it",
          onError: "stop",
        },
      ],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runCount: 0,
      ...overrides,
    };
  }

  function makeExecution(
    overrides?: Partial<ExecutionRecord>,
  ): ExecutionRecord {
    return {
      id: "exec-1",
      workflowId: "wf-1",
      workflowName: "test-workflow",
      triggeredBy: "cron",
      status: "completed",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 1000,
      stepResults: [],
      ...overrides,
    };
  }

  it("saves and retrieves a workflow", async () => {
    const { createWorkflowStore } = await loadModule();
    const store = createWorkflowStore(baseDir);
    const def = makeDefinition();
    store.saveWorkflow(def);
    const retrieved = store.getWorkflow("wf-1");
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe("test-workflow");
  });

  it("writes both JSON and YAML files on save", async () => {
    const { createWorkflowStore } = await loadModule();
    const store = createWorkflowStore(baseDir);
    store.saveWorkflow(makeDefinition());
    const jsonPath = join(baseDir, "definitions", "wf-1.json");
    const yamlPath = join(baseDir, "definitions", "wf-1.yaml");
    expect(existsSync(jsonPath)).toBe(true);
    expect(existsSync(yamlPath)).toBe(true);
    const yamlContent = readFileSync(yamlPath, "utf-8");
    expect(yamlContent).toContain("test-workflow");
  });

  it("lists workflows by owner", async () => {
    const { createWorkflowStore } = await loadModule();
    const store = createWorkflowStore(baseDir);
    store.saveWorkflow(makeDefinition({ id: "wf-1", ownerSenderId: "u1" }));
    store.saveWorkflow(makeDefinition({ id: "wf-2", ownerSenderId: "u1" }));
    store.saveWorkflow(makeDefinition({ id: "wf-3", ownerSenderId: "u2" }));
    const list = store.listWorkflows("telegram", "u1");
    expect(list).toHaveLength(2);
  });

  it("updates a workflow", async () => {
    const { createWorkflowStore } = await loadModule();
    const store = createWorkflowStore(baseDir);
    store.saveWorkflow(makeDefinition());
    store.updateWorkflow("wf-1", { status: "disabled" });
    const updated = store.getWorkflow("wf-1");
    expect(updated?.status).toBe("disabled");
  });

  it("deletes a workflow", async () => {
    const { createWorkflowStore } = await loadModule();
    const store = createWorkflowStore(baseDir);
    store.saveWorkflow(makeDefinition());
    const deleted = store.deleteWorkflow("wf-1");
    expect(deleted).toBe(true);
    expect(store.getWorkflow("wf-1")).toBeUndefined();
  });

  it("returns false when deleting non-existent workflow", async () => {
    const { createWorkflowStore } = await loadModule();
    const store = createWorkflowStore(baseDir);
    const deleted = store.deleteWorkflow("nope");
    expect(deleted).toBe(false);
  });

  it("adds and retrieves execution records", async () => {
    const { createWorkflowStore } = await loadModule();
    const store = createWorkflowStore(baseDir);
    store.saveWorkflow(makeDefinition());
    store.addExecution(makeExecution({ id: "e1" }));
    store.addExecution(makeExecution({ id: "e2" }));
    const records = store.getExecutions("wf-1");
    expect(records).toHaveLength(2);
  });

  it("limits execution records returned", async () => {
    const { createWorkflowStore } = await loadModule();
    const store = createWorkflowStore(baseDir);
    store.saveWorkflow(makeDefinition());
    for (let i = 0; i < 5; i++) {
      store.addExecution(makeExecution({ id: `e-${String(i)}` }));
    }
    const records = store.getExecutions("wf-1", 3);
    expect(records).toHaveLength(3);
  });

  it("saves one-shot execution records to _oneshot/", async () => {
    const { createWorkflowStore } = await loadModule();
    const store = createWorkflowStore(baseDir);
    const exec = makeExecution({
      id: "oneshot-1",
      workflowId: "_oneshot",
    });
    store.addExecution(exec);
    const oneshotDir = join(baseDir, "history", "_oneshot");
    expect(existsSync(oneshotDir)).toBe(true);
    const files = readFileSync(join(oneshotDir, "oneshot-1.json"), "utf-8");
    expect(files).toContain("oneshot-1");
  });

  it("returns undefined for non-existent workflow", async () => {
    const { createWorkflowStore } = await loadModule();
    const store = createWorkflowStore(baseDir);
    expect(store.getWorkflow("nope")).toBeUndefined();
  });

  it("loads workflows from disk on creation", async () => {
    const { createWorkflowStore } = await loadModule();
    const store1 = createWorkflowStore(baseDir);
    store1.saveWorkflow(makeDefinition({ id: "persist-1" }));
    const store2 = createWorkflowStore(baseDir);
    expect(store2.getWorkflow("persist-1")).toBeDefined();
  });

  it("generates webhook secret for webhook-triggered workflows", async () => {
    const { createWorkflowStore } = await loadModule();
    const store = createWorkflowStore(baseDir);
    const def = makeDefinition({
      id: "wh-1",
      trigger: { type: "webhook" as const, value: "/deploy" },
    });
    store.saveWorkflow(def);
    const saved = store.getWorkflow("wh-1");
    expect(saved?.trigger.webhookSecret).toBeDefined();
    expect(saved!.trigger.webhookSecret!.length).toBeGreaterThan(0);
  });

  it("preserves existing webhook secret on save", async () => {
    const { createWorkflowStore } = await loadModule();
    const store = createWorkflowStore(baseDir);
    const def = makeDefinition({
      id: "wh-2",
      trigger: {
        type: "webhook" as const,
        value: "/deploy",
        webhookSecret: "existing-secret",
      },
    });
    store.saveWorkflow(def);
    const saved = store.getWorkflow("wh-2");
    expect(saved?.trigger.webhookSecret).toBe("existing-secret");
  });
});
