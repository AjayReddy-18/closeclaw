import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ScheduledTask, TaskRun, TaskStoreData } from "./task-types.js";
import { TASK_STORE_VERSION, MAX_RUNS_PER_TASK } from "./task-types.js";

export interface TaskStore {
  listTasks(): ScheduledTask[];
  getTask(id: string): ScheduledTask | undefined;
  addTask(task: ScheduledTask): void;
  removeTask(id: string): boolean;
  updateTask(id: string, updates: Partial<ScheduledTask>): void;
  addRun(run: TaskRun): void;
  getRunsForTask(taskId: string, limit?: number): TaskRun[];
}

function emptyStore(): TaskStoreData {
  return { version: TASK_STORE_VERSION, tasks: [], runs: [] };
}

function readStore(path: string): TaskStoreData {
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as TaskStoreData;
    if (!Array.isArray(data.tasks)) return emptyStore();
    return data;
  } catch {
    return emptyStore();
  }
}

function writeStore(path: string, data: TaskStoreData): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf-8");
  renameSync(tmp, path);
}

function pruneRuns(runs: TaskRun[], taskId: string): TaskRun[] {
  const other = runs.filter((r) => r.taskId !== taskId);
  const forTask = runs.filter((r) => r.taskId === taskId);
  if (forTask.length <= MAX_RUNS_PER_TASK) return runs;
  return [...other, ...forTask.slice(forTask.length - MAX_RUNS_PER_TASK)];
}

export function createTaskStore(path: string): TaskStore {
  let data = readStore(path);

  function persist(): void {
    writeStore(path, data);
  }

  return {
    listTasks: () => [...data.tasks],

    getTask: (id) => data.tasks.find((t) => t.id === id),

    addTask(task) {
      data.tasks.push(task);
      persist();
    },

    removeTask(id) {
      const idx = data.tasks.findIndex((t) => t.id === id);
      if (idx === -1) return false;
      data.tasks.splice(idx, 1);
      data.runs = data.runs.filter((r) => r.taskId !== id);
      persist();
      return true;
    },

    updateTask(id, updates) {
      const task = data.tasks.find((t) => t.id === id);
      if (!task) return;
      Object.assign(task, updates);
      persist();
    },

    addRun(run) {
      data.runs.push(run);
      data.runs = pruneRuns(data.runs, run.taskId);
      persist();
    },

    getRunsForTask: (taskId, limit) => {
      const runs = data.runs.filter((r) => r.taskId === taskId);
      return limit ? runs.slice(-limit) : runs;
    },
  };
}
