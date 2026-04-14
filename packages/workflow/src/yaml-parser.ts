import { parse } from "yaml";

export interface YamlParseSuccess {
  success: true;
  data: Record<string, unknown>;
}

export interface YamlParseFailure {
  success: false;
  errors: string[];
}

export type YamlParseResult = YamlParseSuccess | YamlParseFailure;

const REQUIRED_FIELDS = ["name", "steps"];

export function parseWorkflowYaml(yamlText: string): YamlParseResult {
  try {
    const raw = parseFirstDocument(yamlText);
    const missing = findMissingFields(raw);
    if (missing.length > 0) {
      return { success: false, errors: missing.map(fieldError) };
    }
    return { success: true, data: raw };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, errors: [message] };
  }
}

function parseFirstDocument(yamlText: string): Record<string, unknown> {
  const docs = yamlText.split(/^---$/m);
  const firstDoc = docs[0] ?? yamlText;
  const parsed = parse(firstDoc) as unknown;
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("YAML did not parse to an object");
  }
  return parsed as Record<string, unknown>;
}

function findMissingFields(data: Record<string, unknown>): string[] {
  return REQUIRED_FIELDS.filter((f) => !(f in data) || isEmpty(data[f]));
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  return false;
}

function fieldError(field: string): string {
  return `Missing required field: ${field}`;
}
