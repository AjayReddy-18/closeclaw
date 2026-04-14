import { describe, it, expect, vi } from "vitest";

describe("Webhook Route Handler", () => {
  async function loadModule() {
    return import(
      "../../../packages/gateway/src/webhook-handler.js"
    );
  }

  function makeStore() {
    return {
      getWorkflow: vi.fn(),
    };
  }

  function makeRes() {
    return {
      statusCode: 200,
      setHeader: vi.fn(),
      end: vi.fn(),
      headersSent: false,
    };
  }

  it("returns 401 for invalid secret", async () => {
    const { handleWebhook } = await loadModule();
    const store = makeStore();
    store.getWorkflow.mockReturnValue({
      id: "wf-1",
      status: "active",
      trigger: { type: "webhook", webhookSecret: "correct-secret" },
    });
    const res = makeRes();
    await handleWebhook("wf-1", "wrong-secret", store as never, res as never);
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for non-existent workflow", async () => {
    const { handleWebhook } = await loadModule();
    const store = makeStore();
    store.getWorkflow.mockReturnValue(undefined);
    const res = makeRes();
    await handleWebhook("wf-99", "secret", store as never, res as never);
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 for disabled workflow", async () => {
    const { handleWebhook } = await loadModule();
    const store = makeStore();
    store.getWorkflow.mockReturnValue({
      id: "wf-1",
      status: "disabled",
      trigger: { type: "webhook", webhookSecret: "secret" },
    });
    const res = makeRes();
    await handleWebhook("wf-1", "secret", store as never, res as never);
    expect(res.statusCode).toBe(404);
  });

  it("returns 202 for valid webhook trigger", async () => {
    const { handleWebhook } = await loadModule();
    const store = makeStore();
    store.getWorkflow.mockReturnValue({
      id: "wf-1",
      status: "active",
      trigger: { type: "webhook", webhookSecret: "valid-secret" },
    });
    const res = makeRes();
    const onTrigger = vi.fn().mockResolvedValue(undefined);
    await handleWebhook(
      "wf-1",
      "valid-secret",
      store as never,
      res as never,
      onTrigger,
    );
    expect(res.statusCode).toBe(202);
    expect(onTrigger).toHaveBeenCalled();
  });
});
