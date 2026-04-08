import type { BotAdapter } from "@closeclaw/bot-adapters";

export async function connectAllAdapters(adapters: BotAdapter[]): Promise<void> {
  await Promise.all(adapters.map((a) => a.connect()));
}

export async function disconnectAllAdapters(adapters: BotAdapter[]): Promise<void> {
  await Promise.all(adapters.map((a) => a.disconnect().catch(() => {})));
}

export function waitForSigint(): Promise<void> {
  return new Promise((resolve) => {
    const done = (): void => {
      process.off("SIGINT", done);
      process.off("SIGTERM", done);
      resolve();
    };
    process.on("SIGINT", done);
    process.on("SIGTERM", done);
  });
}
