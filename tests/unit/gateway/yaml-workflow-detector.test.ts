import { describe, it, expect } from "vitest";

describe("extractYamlBlock", () => {
  async function loadModule() {
    return import("../../../packages/gateway/src/yaml-workflow-detector.js");
  }

  it("extracts YAML from fenced code block", async () => {
    const { extractYamlBlock } = await loadModule();
    const msg =
      "Here is my workflow:\n```yaml\nname: test\nsteps:\n  - id: s1\n```";
    const result = extractYamlBlock(msg);
    expect(result).toContain("name: test");
    expect(result).toContain("steps:");
  });

  it("extracts YAML from yml fence", async () => {
    const { extractYamlBlock } = await loadModule();
    const msg = "```yml\nname: test\nsteps:\n  - id: s1\n```";
    const result = extractYamlBlock(msg);
    expect(result).toContain("name: test");
  });

  it("detects bare YAML structure", async () => {
    const { extractYamlBlock } = await loadModule();
    const msg = "name: my-workflow\nsteps:\n  - id: s1";
    const result = extractYamlBlock(msg);
    expect(result).toContain("name: my-workflow");
  });

  it("returns undefined for plain text", async () => {
    const { extractYamlBlock } = await loadModule();
    const result = extractYamlBlock("just a regular message");
    expect(result).toBeUndefined();
  });

  it("returns undefined for non-yaml code blocks", async () => {
    const { extractYamlBlock } = await loadModule();
    const msg = "```js\nconst x = 1;\n```";
    const result = extractYamlBlock(msg);
    expect(result).toBeUndefined();
  });
});
