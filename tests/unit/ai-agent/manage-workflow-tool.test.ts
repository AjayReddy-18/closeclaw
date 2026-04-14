import { describe, it, expect, vi } from "vitest";

describe("manageWorkflowTool", () => {
  async function loadModule() {
    return import(
      "../../../packages/ai-agent/src/tools/manage-workflow-tool.js"
    );
  }

  function makeStore() {
    return {
      listWorkflows: vi.fn().mockReturnValue([
        { id: "wf-1", name: "test", status: "active" },
      ]),
      getWorkflow: vi.fn().mockReturnValue({ id: "wf-1", status: "active" }),
      updateWorkflow: vi.fn(),
      deleteWorkflow: vi.fn().mockReturnValue(true),
      getExecutions: vi.fn().mockReturnValue([]),
    };
  }

  it("lists workflows", async () => {
    const { createManageWorkflowTool } = await loadModule();
    const store = makeStore();
    const tool = createManageWorkflowTool(store, "telegram", "user-1");
    const result = await tool.execute({ action: "list" });
    expect(store.listWorkflows).toHaveBeenCalledWith("telegram", "user-1");
    expect(result).toBeDefined();
  });

  it("enables a workflow", async () => {
    const { createManageWorkflowTool } = await loadModule();
    const store = makeStore();
    const tool = createManageWorkflowTool(store, "telegram", "user-1");
    await tool.execute({ action: "enable", workflowId: "wf-1" });
    expect(store.updateWorkflow).toHaveBeenCalledWith("wf-1", {
      status: "active",
    });
  });

  it("disables a workflow", async () => {
    const { createManageWorkflowTool } = await loadModule();
    const store = makeStore();
    const tool = createManageWorkflowTool(store, "telegram", "user-1");
    await tool.execute({ action: "disable", workflowId: "wf-1" });
    expect(store.updateWorkflow).toHaveBeenCalledWith("wf-1", {
      status: "disabled",
    });
  });

  it("deletes a workflow", async () => {
    const { createManageWorkflowTool } = await loadModule();
    const store = makeStore();
    const tool = createManageWorkflowTool(store, "telegram", "user-1");
    const result = await tool.execute({ action: "delete", workflowId: "wf-1" });
    expect(store.deleteWorkflow).toHaveBeenCalledWith("wf-1");
    expect(result).toBeDefined();
  });

  it("retrieves execution history", async () => {
    const { createManageWorkflowTool } = await loadModule();
    const store = makeStore();
    const tool = createManageWorkflowTool(store, "telegram", "user-1");
    await tool.execute({
      action: "history",
      workflowId: "wf-1",
      limit: 5,
    });
    expect(store.getExecutions).toHaveBeenCalledWith("wf-1", 5);
  });
});
