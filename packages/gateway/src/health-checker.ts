import type {
  BotAdapter,
  BotHealthResult,
} from "@closeclaw/bot-adapters";

export type HealthCheckResult = {
  status: "healthy" | "unhealthy";
  channels: Record<string, BotHealthResult>;
};

function allConnected(
  results: readonly BotHealthResult[],
): boolean {
  return results.every((r) => r.connected);
}

export async function checkHealth(
  adapters: BotAdapter[],
): Promise<HealthCheckResult> {
  const entries = await Promise.all(
    adapters.map(async (a) => {
      const r = await a.healthCheck();
      return [a.platform, r] as const;
    }),
  );
  const channels = Object.fromEntries(entries);
  const list = entries.map(([, v]) => v);
  const status = allConnected(list) ? "healthy" : "unhealthy";
  return { status, channels };
}
