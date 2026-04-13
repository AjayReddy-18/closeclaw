import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@inquirer/prompts": resolve(
        __dirname,
        "tests/__mocks__/inquirer-prompts.ts",
      ),
      "@inquirer/core": resolve(__dirname, "tests/__mocks__/inquirer-core.ts"),
      grammy: resolve(__dirname, "tests/__mocks__/grammy.ts"),
      "discord.js": resolve(__dirname, "tests/__mocks__/discord-js.ts"),
      "@closeclaw/shared-types": resolve(
        __dirname,
        "packages/shared-types/src/index.ts",
      ),
      "@closeclaw/bot-adapters": resolve(
        __dirname,
        "packages/bot-adapters/src/index.ts",
      ),
      "@closeclaw/gateway": resolve(__dirname, "packages/gateway/src/index.ts"),
      "@closeclaw/cli": resolve(__dirname, "packages/cli/src/index.ts"),
      "@closeclaw/ai-agent": resolve(
        __dirname,
        "packages/ai-agent/src/index.ts",
      ),
      "@closeclaw/mcp-client": resolve(
        __dirname,
        "packages/mcp-client/src/index.ts",
      ),
      "@closeclaw/cursor-agent": resolve(
        __dirname,
        "packages/cursor-agent/src/index.ts",
      ),
      "@closeclaw/orchestrator": resolve(
        __dirname,
        "packages/orchestrator/src/index.ts",
      ),
      ai: resolve(__dirname, "tests/__mocks__/ai-sdk.ts"),
      "@ai-sdk/openai": resolve(__dirname, "tests/__mocks__/ai-sdk.ts"),
      "@ai-sdk/anthropic": resolve(__dirname, "tests/__mocks__/ai-sdk.ts"),
      "@ai-sdk/google": resolve(__dirname, "tests/__mocks__/ai-sdk.ts"),
      "@ai-sdk/provider": resolve(
        __dirname,
        "tests/__mocks__/ai-sdk-provider.ts",
      ),
    },
  },
  test: {
    globals: true,
    root: ".",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      exclude: [
        "packages/*/src/index.ts",
        "packages/**/*.d.ts",
        "packages/cli/src/cli.ts",
        "packages/bot-adapters/src/adapter.ts",
        "packages/ai-agent/src/conversation-types.ts",
        "packages/orchestrator/src/types.ts",
      ],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
