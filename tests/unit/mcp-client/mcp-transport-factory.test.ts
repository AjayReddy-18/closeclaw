import { describe, it, expect } from "vitest";
import { createTransport } from "../../../packages/mcp-client/src/mcp-transport-factory.js";
import type {
  StdioServerConfig,
  HttpServerConfig,
} from "../../../packages/mcp-client/src/mcp-config-types.js";

describe("createTransport", () => {
  it("creates Streamable HTTP transport for http config", () => {
    const config: HttpServerConfig = {
      name: "jira",
      type: "http",
      url: "http://localhost:8000/mcp",
      headers: { Authorization: "Bearer token" },
      enabled: true,
    };
    const transport = createTransport(config);
    expect(transport).toEqual({
      type: "http",
      url: "http://localhost:8000/mcp/",
      headers: { Authorization: "Bearer token" },
    });
  });

  it("omits headers when empty for http config", () => {
    const config: HttpServerConfig = {
      name: "plain",
      type: "http",
      url: "http://localhost/mcp/",
      headers: {},
      enabled: true,
    };
    const transport = createTransport(config);
    expect(transport).toEqual({
      type: "http",
      url: "http://localhost/mcp/",
      headers: undefined,
    });
  });

  it("ensures trailing slash on URL", () => {
    const config: HttpServerConfig = {
      name: "test",
      type: "http",
      url: "http://localhost:8000/mcp",
      headers: {},
      enabled: true,
    };
    const transport = createTransport(config);
    expect("url" in transport && transport.url).toBe(
      "http://localhost:8000/mcp/",
    );
  });

  it("preserves existing trailing slash", () => {
    const config: HttpServerConfig = {
      name: "test",
      type: "http",
      url: "http://localhost:8000/mcp/",
      headers: {},
      enabled: true,
    };
    const transport = createTransport(config);
    expect("url" in transport && transport.url).toBe(
      "http://localhost:8000/mcp/",
    );
  });

  it("creates StdioMCPTransport for stdio config", () => {
    const config: StdioServerConfig = {
      name: "fs",
      type: "stdio",
      command: "npx",
      args: ["-y", "@mcp/server"],
      env: { KEY: "val" },
      enabled: true,
    };
    const transport = createTransport(config);
    expect(transport).toBeDefined();
    expect(typeof transport).toBe("object");
    expect("type" in transport && transport.type === "http").toBe(false);
  });
});
