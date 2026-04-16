interface KeywordWorkflow {
  id: string;
  status: string;
  trigger: { type: string; value: string };
}

interface KeywordStore {
  listWorkflows(platform: string, senderId: string): KeywordWorkflow[];
}

export type KeywordTriggerCallback = (
  workflow: KeywordWorkflow,
) => Promise<void>;

export function matchKeywordWorkflow(
  text: string,
  store: KeywordStore,
  platform: string,
  senderId: string,
): KeywordWorkflow | undefined {
  const lower = text.toLowerCase().trim();
  const workflows = store.listWorkflows(platform, senderId);
  return workflows.find(
    (wf) =>
      wf.status === "active" &&
      wf.trigger.type === "chat_keyword" &&
      lower.includes(wf.trigger.value.toLowerCase()),
  );
}
