import { describe, it, expect } from "vitest";

describe("matchKeywordWorkflow", () => {
  async function loadModule() {
    return import("../../../packages/gateway/src/keyword-trigger.js");
  }

  function makeStore(
    workflows: Array<{
      id: string;
      status: string;
      trigger: { type: string; value: string };
    }>,
  ) {
    return {
      listWorkflows: () => workflows,
    };
  }

  it("matches keyword case-insensitively", async () => {
    const { matchKeywordWorkflow } = await loadModule();
    const store = makeStore([
      {
        id: "wf-1",
        status: "active",
        trigger: { type: "chat_keyword", value: "deploy" },
      },
    ]);
    const match = matchKeywordWorkflow("Deploy now", store, "telegram", "u1");
    expect(match).toBeDefined();
    expect(match!.id).toBe("wf-1");
  });

  it("returns undefined when no keyword matches", async () => {
    const { matchKeywordWorkflow } = await loadModule();
    const store = makeStore([
      {
        id: "wf-1",
        status: "active",
        trigger: { type: "chat_keyword", value: "deploy" },
      },
    ]);
    const match = matchKeywordWorkflow("hello world", store, "telegram", "u1");
    expect(match).toBeUndefined();
  });

  it("skips disabled workflows", async () => {
    const { matchKeywordWorkflow } = await loadModule();
    const store = makeStore([
      {
        id: "wf-1",
        status: "disabled",
        trigger: { type: "chat_keyword", value: "deploy" },
      },
    ]);
    const match = matchKeywordWorkflow("deploy", store, "telegram", "u1");
    expect(match).toBeUndefined();
  });

  it("skips non-keyword trigger types", async () => {
    const { matchKeywordWorkflow } = await loadModule();
    const store = makeStore([
      {
        id: "wf-1",
        status: "active",
        trigger: { type: "cron", value: "deploy" },
      },
    ]);
    const match = matchKeywordWorkflow("deploy", store, "telegram", "u1");
    expect(match).toBeUndefined();
  });

  it("matches partial keyword within message", async () => {
    const { matchKeywordWorkflow } = await loadModule();
    const store = makeStore([
      {
        id: "wf-1",
        status: "active",
        trigger: { type: "chat_keyword", value: "run tests" },
      },
    ]);
    const match = matchKeywordWorkflow(
      "please run tests now",
      store,
      "telegram",
      "u1",
    );
    expect(match).toBeDefined();
  });
});
