import { describe, it, expect } from "vitest";

describe("parseWorkflowYaml", () => {
  async function loadModule() {
    return import("../../../packages/workflow/src/yaml-parser.js");
  }

  const validYaml = `
name: test-workflow
trigger:
  type: cron
  value: "0 9 * * *"
steps:
  - id: s1
    type: action
    label: Fetch data
    prompt: Get the latest data
    onError: stop
`;

  it("parses valid YAML into a raw object", async () => {
    const { parseWorkflowYaml } = await loadModule();
    const result = parseWorkflowYaml(validYaml);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("test-workflow");
      expect(result.data.steps).toHaveLength(1);
    }
  });

  it("returns errors for invalid YAML syntax", async () => {
    const { parseWorkflowYaml } = await loadModule();
    const result = parseWorkflowYaml("{{invalid yaml: [");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("returns errors for missing required fields", async () => {
    const { parseWorkflowYaml } = await loadModule();
    const result = parseWorkflowYaml("name: only-name");
    expect(result.success).toBe(false);
  });

  it("parses condition steps", async () => {
    const { parseWorkflowYaml } = await loadModule();
    const yaml = `
name: branch-test
trigger:
  type: cron
  value: "0 9 * * *"
steps:
  - id: cond
    type: condition
    label: Check
    condition: "Is it good?"
    thenSteps:
      - id: t1
        type: action
        label: Good
        prompt: do good
        onError: stop
    elseSteps: []
`;
    const result = parseWorkflowYaml(yaml);
    expect(result.success).toBe(true);
  });

  it("returns parse result for multi-document YAML (first doc)", async () => {
    const { parseWorkflowYaml } = await loadModule();
    const yaml = `
name: first
trigger:
  type: cron
  value: "0 9 * * *"
steps:
  - id: s1
    type: action
    label: Go
    prompt: go
    onError: stop
---
name: second
steps: []
`;
    const result = parseWorkflowYaml(yaml);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("first");
    }
  });
});
