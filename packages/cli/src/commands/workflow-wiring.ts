import type { createMessageProcessor } from "@closeclaw/ai-agent";
import type { BotAdapter } from "@closeclaw/bot-adapters";
import { runWorkflow, type WorkflowDefinition } from "@closeclaw/workflow";
import { setupWorkflowSystem, type WorkflowAssembly } from "./workflow-setup.js";

export function initWorkflowSystem(): WorkflowAssembly {
  return setupWorkflowSystem(async () => {
    throw new Error("Workflow executor not yet wired");
  });
}

export function wireWorkflowExecutor(
  assembly: WorkflowAssembly,
  processor: ReturnType<typeof createMessageProcessor>,
  adapters: BotAdapter[],
): void {
  assembly.scheduler.stop();
  const newAssembly = setupWorkflowSystem(async (workflow, triggerPayload) => {
    await executeAndDeliver(workflow, processor, adapters, triggerPayload);
  });
  Object.assign(assembly.scheduler, newAssembly.scheduler);
  startSchedulerWithStore(assembly, newAssembly);
}

function startSchedulerWithStore(
  orig: WorkflowAssembly,
  wired: WorkflowAssembly,
): void {
  const all = orig.store.listWorkflows("telegram", "");
  if (all.length > 0) {
    wired.scheduler.start(all);
    console.log(`[workflow] ${String(all.length)} workflows loaded`);
  }
}

async function executeAndDeliver(
  workflow: WorkflowDefinition,
  processor: ReturnType<typeof createMessageProcessor>,
  adapters: BotAdapter[],
  triggerPayload?: Record<string, unknown>,
): Promise<void> {
  const record = await runWorkflow(
    workflow,
    {
      processMessage: (platform, senderId, text) =>
        processor.processMessage(platform, senderId, text),
      platform: workflow.ownerPlatform,
      senderId: workflow.ownerSenderId,
    },
    triggerPayload,
  );
  const adapter = adapters[0];
  if (!adapter) return;
  const summary = `Workflow **${workflow.name}** ${record.status}.`;
  await adapter.sendMessage(workflow.ownerSenderId, summary);
}
