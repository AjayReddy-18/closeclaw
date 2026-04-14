import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { stringify as yamlStringify } from "yaml";
import type { WorkflowDefinition, ExecutionRecord } from "./types.js";

const ONESHOT_WORKFLOW_ID = "_oneshot";

export interface WorkflowStore {
  getWorkflow(id: string): WorkflowDefinition | undefined;
  saveWorkflow(workflow: WorkflowDefinition): void;
  listWorkflows(platform: string, senderId: string): WorkflowDefinition[];
  updateWorkflow(id: string, updates: Partial<WorkflowDefinition>): void;
  deleteWorkflow(id: string): boolean;
  addExecution(record: ExecutionRecord): void;
  getExecutions(workflowId: string, limit?: number): ExecutionRecord[];
}

export function createWorkflowStore(baseDir: string): WorkflowStore {
  const defsDir = join(baseDir, "definitions");
  const histDir = join(baseDir, "history");
  ensureDir(defsDir);
  ensureDir(histDir);
  const workflows = loadAllDefinitions(defsDir);

  return {
    getWorkflow: (id) => workflows.get(id),
    saveWorkflow: (wf) => saveDefinition(wf, defsDir, workflows),
    listWorkflows: (platform, senderId) =>
      filterByOwner(workflows, platform, senderId),
    updateWorkflow: (id, updates) =>
      applyUpdate(id, updates, defsDir, workflows),
    deleteWorkflow: (id) => removeDefinition(id, defsDir, workflows),
    addExecution: (record) => persistExecution(record, histDir),
    getExecutions: (wfId, limit) => loadExecutions(wfId, histDir, limit),
  };
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function atomicWriteJson(filePath: string, data: unknown): void {
  const tmp = filePath + ".tmp";
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, filePath);
}

function saveDefinition(
  wf: WorkflowDefinition,
  defsDir: string,
  cache: Map<string, WorkflowDefinition>,
): void {
  cache.set(wf.id, wf);
  atomicWriteJson(join(defsDir, `${wf.id}.json`), wf);
  writeYamlCopy(wf, defsDir);
}

function writeYamlCopy(wf: WorkflowDefinition, defsDir: string): void {
  const yamlPath = join(defsDir, `${wf.id}.yaml`);
  const tmp = yamlPath + ".tmp";
  writeFileSync(tmp, yamlStringify(wf));
  renameSync(tmp, yamlPath);
}

function filterByOwner(
  cache: Map<string, WorkflowDefinition>,
  platform: string,
  senderId: string,
): WorkflowDefinition[] {
  return [...cache.values()].filter(
    (wf) => wf.ownerPlatform === platform && wf.ownerSenderId === senderId,
  );
}

function applyUpdate(
  id: string,
  updates: Partial<WorkflowDefinition>,
  defsDir: string,
  cache: Map<string, WorkflowDefinition>,
): void {
  const existing = cache.get(id);
  if (!existing) return;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  saveDefinition(updated, defsDir, cache);
}

function removeDefinition(
  id: string,
  defsDir: string,
  cache: Map<string, WorkflowDefinition>,
): boolean {
  if (!cache.has(id)) return false;
  cache.delete(id);
  safeUnlink(join(defsDir, `${id}.json`));
  safeUnlink(join(defsDir, `${id}.yaml`));
  return true;
}

function safeUnlink(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    /* file may not exist */
  }
}

function persistExecution(record: ExecutionRecord, histDir: string): void {
  const dir = resolveExecutionDir(record.workflowId, histDir);
  ensureDir(dir);
  atomicWriteJson(join(dir, `${record.id}.json`), record);
}

function resolveExecutionDir(workflowId: string, histDir: string): string {
  if (workflowId === ONESHOT_WORKFLOW_ID) {
    return join(histDir, ONESHOT_WORKFLOW_ID);
  }
  return join(histDir, workflowId);
}

function loadExecutions(
  workflowId: string,
  histDir: string,
  limit?: number,
): ExecutionRecord[] {
  const dir = resolveExecutionDir(workflowId, histDir);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();
  const sliced = limit ? files.slice(0, limit) : files;
  return sliced.map((f) =>
    JSON.parse(readFileSync(join(dir, f), "utf-8")) as ExecutionRecord,
  );
}

function loadAllDefinitions(
  defsDir: string,
): Map<string, WorkflowDefinition> {
  const map = new Map<string, WorkflowDefinition>();
  if (!existsSync(defsDir)) return map;
  for (const file of readdirSync(defsDir)) {
    if (!file.endsWith(".json")) continue;
    const data = JSON.parse(
      readFileSync(join(defsDir, file), "utf-8"),
    ) as WorkflowDefinition;
    map.set(data.id, data);
  }
  return map;
}
