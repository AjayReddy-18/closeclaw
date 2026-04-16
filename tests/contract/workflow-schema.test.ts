import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAllDocuments } from "yaml";

describe("Workflow YAML Schema Contract", () => {
  async function loadValidator() {
    return import("../../packages/workflow/src/workflow-validator.js");
  }

  function loadYamlExamples(): unknown[] {
    const yamlPath = join(
      __dirname,
      "../../specs/011-workflow-engine/contracts/workflow-yaml-schema.yaml",
    );
    const raw = readFileSync(yamlPath, "utf-8");
    return parseAllDocuments(raw).map((doc) => doc.toJSON());
  }

  function wrapAsDefinition(raw: Record<string, unknown>): unknown {
    return {
      id: "test-" + String(Math.random()).slice(2, 8),
      ownerPlatform: "telegram",
      ownerSenderId: "test-user",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runCount: 0,
      trigger: raw["trigger"] ?? { type: "cron", value: "0 9 * * *" },
      ...raw,
    };
  }

  it("all YAML examples pass validation when wrapped", async () => {
    const { validateWorkflowDefinition } = await loadValidator();
    const examples = loadYamlExamples();
    expect(examples.length).toBeGreaterThan(0);
    for (const example of examples) {
      const wrapped = wrapAsDefinition(example as Record<string, unknown>);
      const result = validateWorkflowDefinition(wrapped);
      if (!result.valid) {
        const name = (example as Record<string, unknown>).name ?? "unknown";
        throw new Error(
          `Example "${String(name)}" failed: ${result.errors.join(", ")}`,
        );
      }
    }
  });

  it("rejects invalid YAML structure", async () => {
    const { validateWorkflowDefinition } = await loadValidator();
    const invalid = { name: "bad", steps: "not-array" };
    const result = validateWorkflowDefinition(wrapAsDefinition(invalid));
    expect(result.valid).toBe(false);
  });

  it("rejects empty steps", async () => {
    const { validateWorkflowDefinition } = await loadValidator();
    const invalid = { name: "empty", steps: [] };
    const result = validateWorkflowDefinition(wrapAsDefinition(invalid));
    expect(result.valid).toBe(false);
  });
});
