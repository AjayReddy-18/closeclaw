import { describe, it, expect, vi } from "vitest";

describe("createApprovalQueue", () => {
  async function loadModule() {
    return import("../../../packages/orchestrator/src/approval-queue.js");
  }

  function makeAskFn(responses: ("approve" | "deny")[]) {
    let idx = 0;
    return vi.fn().mockImplementation(async () => responses[idx++] ?? "deny");
  }

  it("sends first prompt immediately", async () => {
    const { createApprovalQueue } = await loadModule();
    const askFn = makeAskFn(["approve"]);
    const queue = createApprovalQueue(askFn);
    const result = await queue.enqueue("task-1", [
      { command: "rm -rf", description: "delete files" },
    ]);
    expect(result).toBe("approve");
    expect(askFn).toHaveBeenCalledTimes(1);
    queue.dispose();
  });

  it("queues second prompt until first resolves", async () => {
    const { createApprovalQueue } = await loadModule();
    let resolveFirst!: (v: "approve" | "deny") => void;
    const askFn = vi.fn().mockImplementation(
      () => new Promise<"approve" | "deny">((r) => { resolveFirst = r; }),
    );

    const queue = createApprovalQueue(askFn);
    const first = queue.enqueue("task-1", [{ command: "a", description: "x" }]);
    const second = queue.enqueue("task-2", [{ command: "b", description: "y" }]);

    expect(askFn).toHaveBeenCalledTimes(1);

    resolveFirst("approve");
    await first;
    expect(askFn).toHaveBeenCalledTimes(2);

    resolveFirst("deny");
    const secondResult = await second;
    expect(secondResult).toBe("deny");
    queue.dispose();
  });

  it("includes task label in the prompt text", async () => {
    const { createApprovalQueue } = await loadModule();
    const askFn = makeAskFn(["approve"]);
    const queue = createApprovalQueue(askFn);
    await queue.enqueue("Fetch Jira", [
      { command: "fetch", description: "fetch issues" },
    ]);
    const promptArg = askFn.mock.calls[0][0] as string;
    expect(promptArg).toContain("Fetch Jira");
    queue.dispose();
  });

  it("dispose rejects queued entries", async () => {
    const { createApprovalQueue } = await loadModule();
    const askFn = vi.fn().mockImplementation(
      () => new Promise<"approve" | "deny">(() => {}),
    );
    const queue = createApprovalQueue(askFn);
    queue.enqueue("task-1", [{ command: "a", description: "x" }]);
    const pending = queue.enqueue("task-2", [{ command: "b", description: "y" }]);
    queue.dispose();
    await expect(pending).rejects.toThrow("disposed");
  });

  it("processes entries in FIFO order", async () => {
    const { createApprovalQueue } = await loadModule();
    const order: string[] = [];
    let resolvers: Array<(v: "approve" | "deny") => void> = [];
    const askFn = vi.fn().mockImplementation((prompt: string) => {
      order.push(prompt);
      return new Promise<"approve" | "deny">((r) => { resolvers.push(r); });
    });

    const queue = createApprovalQueue(askFn);
    const p1 = queue.enqueue("first", [{ command: "a", description: "x" }]);
    const p2 = queue.enqueue("second", [{ command: "b", description: "y" }]);
    const p3 = queue.enqueue("third", [{ command: "c", description: "z" }]);

    expect(order[0]).toContain("[first]");
    resolvers[0]("approve");
    await p1;

    expect(order.length).toBe(2);
    resolvers[1]("deny");
    await p2;

    resolvers[2]("approve");
    await p3;
    expect(order.length).toBe(3);
    queue.dispose();
  });
});
