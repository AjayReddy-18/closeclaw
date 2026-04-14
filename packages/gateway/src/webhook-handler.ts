import type { ServerResponse } from "node:http";

interface WorkflowView {
  id: string;
  status: string;
  trigger: { type: string; webhookSecret?: string };
}

interface WorkflowStoreView {
  getWorkflow(id: string): WorkflowView | undefined;
}

type TriggerCallback = (workflow: WorkflowView) => Promise<void>;

export async function handleWebhook(
  workflowId: string,
  authSecret: string,
  store: WorkflowStoreView,
  res: ServerResponse,
  onTrigger?: TriggerCallback,
): Promise<void> {
  const workflow = store.getWorkflow(workflowId);
  if (!workflow || workflow.status !== "active") {
    sendStatus(res, 404);
    return;
  }
  if (workflow.trigger.webhookSecret !== authSecret) {
    sendStatus(res, 401);
    return;
  }
  sendStatus(res, 202);
  if (onTrigger) {
    onTrigger(workflow).catch((err) =>
      console.error("[webhook] Execution error:", err),
    );
  }
}

function sendStatus(res: ServerResponse, code: number): void {
  res.statusCode = code;
  res.end();
}
