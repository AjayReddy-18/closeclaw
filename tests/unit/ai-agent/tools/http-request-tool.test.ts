import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHttpRequestTool } from "../../../../packages/ai-agent/src/tools/http-request-tool.js";

describe("createHttpRequestTool", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns a tool object", () => {
    const t = createHttpRequestTool();
    expect(t.type).toBe("function");
    expect(t.execute).toBeTypeOf("function");
  });

  it("GET calls fetch with method and URL and returns status and body", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response("ok-body", { status: 200, statusText: "OK" }),
    );
    const t = createHttpRequestTool();
    const out = (await t.execute!({
      method: "GET",
      url: "https://example.com/x",
    })) as { status: number; statusText: string; body: string };
    expect(globalThis.fetch).toHaveBeenCalledWith("https://example.com/x", {
      method: "GET",
      headers: undefined,
      body: undefined,
    });
    expect(out.status).toBe(200);
    expect(out.statusText).toBe("OK");
    expect(out.body).toBe("ok-body");
  });

  it("POST includes body", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response("created", { status: 201, statusText: "Created" }),
    );
    const t = createHttpRequestTool();
    await t.execute!({
      method: "POST",
      url: "https://example.com/api",
      body: '{"a":1}',
    });
    expect(globalThis.fetch).toHaveBeenCalledWith("https://example.com/api", {
      method: "POST",
      headers: undefined,
      body: '{"a":1}',
    });
  });

  it("returns status 0 on fetch failure", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("network down"));
    const t = createHttpRequestTool();
    const out = (await t.execute!({
      method: "GET",
      url: "https://example.com/y",
    })) as { status: number; statusText: string; body: string };
    expect(out.status).toBe(0);
    expect(out.statusText).toBe("Request failed");
    expect(out.body).toBe("network down");
  });

  it("truncates response longer than 10000 chars", async () => {
    const huge = "x".repeat(12_000);
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(huge, { status: 200, statusText: "OK" }),
    );
    const t = createHttpRequestTool();
    const out = (await t.execute!({
      method: "GET",
      url: "https://example.com/big",
    })) as { body: string };
    expect(out.body.endsWith("...[truncated]")).toBe(true);
    expect(out.body.length).toBeLessThanOrEqual(
      10_000 + "...[truncated]".length,
    );
  });
});
