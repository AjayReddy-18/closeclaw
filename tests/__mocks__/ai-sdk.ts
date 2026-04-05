import { vi } from "vitest";

export const generateText = vi.fn().mockResolvedValue({
  text: "mocked response",
  toolCalls: [],
  toolResults: [],
  finishReason: "stop",
  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
});

export function tool(config: {
  description: string;
  inputSchema: unknown;
  execute?: (...args: unknown[]) => unknown;
}) {
  return { ...config, type: "function" as const };
}

export function stepCountIs(n: number) {
  return { type: "step-count" as const, count: n };
}

function createMockModelFactory(providerName: string) {
  return vi.fn().mockImplementation((options?: Record<string, unknown>) => {
    const modelFactory = vi.fn().mockImplementation((modelId: string) => ({
      provider: providerName,
      modelId,
      options,
      specificationVersion: "v2",
    }));
    return modelFactory;
  });
}

export const createOpenAI = createMockModelFactory("openai");
export const createAnthropic = createMockModelFactory("anthropic");
export const createGoogleGenerativeAI = createMockModelFactory("google");
