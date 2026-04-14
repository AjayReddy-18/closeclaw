import { randomUUID } from "node:crypto";
import type {
  ExecutionRecord,
  ExecutionStatus,
  StepResult,
  TriggerType,
} from "./types.js";

export interface ExecutionRecorder {
  getRecord(): ExecutionRecord;
  addStepResult(result: StepResult): void;
  finalize(status: ExecutionStatus, abortReason?: string): ExecutionRecord;
}

export function createExecutionRecorder(
  workflowId: string,
  workflowName: string,
  triggeredBy: TriggerType,
  triggerPayload?: Record<string, unknown>,
): ExecutionRecorder {
  const record: ExecutionRecord = {
    id: randomUUID().slice(0, 8),
    workflowId,
    workflowName,
    triggeredBy,
    triggerPayload,
    status: "running",
    startedAt: new Date().toISOString(),
    stepResults: [],
  };

  return {
    getRecord: () => ({ ...record, stepResults: [...record.stepResults] }),
    addStepResult: (result) => record.stepResults.push(result),
    finalize: (status, abortReason) =>
      finalizeRecord(record, status, abortReason),
  };
}

function finalizeRecord(
  record: ExecutionRecord,
  status: ExecutionStatus,
  abortReason?: string,
): ExecutionRecord {
  record.status = status;
  record.completedAt = new Date().toISOString();
  record.durationMs =
    new Date(record.completedAt).getTime() -
    new Date(record.startedAt).getTime();
  if (abortReason) record.abortReason = abortReason;
  return { ...record, stepResults: [...record.stepResults] };
}
