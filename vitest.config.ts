import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@inquirer/prompts": resolve(
        __dirname,
        "tests/__mocks__/inquirer-prompts.ts",
      ),
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
      "@closeclaw/gateway": resolve(
        __dirname,
        "packages/gateway/src/index.ts",
      ),
      "@closeclaw/cli": resolve(
        __dirname,
        "packages/cli/src/index.ts",
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
      exclude: ["packages/*/src/index.ts"],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
