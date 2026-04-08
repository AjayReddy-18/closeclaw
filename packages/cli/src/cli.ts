import { homedir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { createOnboardDeps, runOnboard } from "./commands/onboard.js";
import {
  createGatewayStartDeps,
  runGatewayStart,
} from "./commands/gateway-start.js";
import { runPairingList } from "./commands/pairing-list.js";
import { runPairingApprove } from "./commands/pairing-approve.js";
import {
  createAgentSystemPromptDeps,
  runAgentSystemPrompt,
} from "./commands/agent-system-prompt.js";
import {
  createAgentConfigureDeps,
  runAgentConfigure,
} from "./commands/agent-configure.js";
import {
  createAgentConversationsDeps,
  runAgentConversations,
} from "./commands/agent-conversations.js";
import {
  createCronStoreDeps,
  registerCronCommands,
} from "./commands/cron-registry.js";
import {
  registerHeartbeatCommands,
  createHeartbeatDeps,
} from "./commands/heartbeat-registry.js";
import { registerMcpCommands, createMcpDeps } from "./commands/mcp-registry.js";

export async function runCli(argv: string[]): Promise<number> {
  const program = new Command();
  program.name("closeclaw");
  program
    .command("onboard")
    .description("Run interactive onboarding")
    .action(async () => {
      await runOnboard(createOnboardDeps());
    });
  const pairing = program.command("pairing");
  pairing.command("list").action(async () => {
    await runPairingList({
      storePath: join(homedir(), ".closeclaw", "pairing.json"),
    });
  });
  pairing
    .command("approve")
    .argument("<code>", "code")
    .action(async (code: string) => {
      await runPairingApprove(code, {
        storePath: join(homedir(), ".closeclaw", "pairing.json"),
      });
    });
  const gateway = program.command("gateway");
  gateway.command("start").action(async () => {
    await runGatewayStart(createGatewayStartDeps());
  });
  const agent = program.command("agent");
  agent
    .command("configure")
    .description("Interactive agent provider and model setup")
    .action(async () => {
      await runAgentConfigure(createAgentConfigureDeps());
    });
  agent
    .command("system-prompt")
    .description("View or edit the AI agent system prompt")
    .action(async () => {
      await runAgentSystemPrompt(createAgentSystemPromptDeps());
    });
  agent
    .command("conversations")
    .description("List active AI conversations")
    .action(async () => {
      await runAgentConversations(createAgentConversationsDeps());
    });
  registerCronCommands(program, createCronStoreDeps());
  registerHeartbeatCommands(program, createHeartbeatDeps());
  registerMcpCommands(program, createMcpDeps());
  try {
    await program.parseAsync(argv);
    return 0;
  } catch {
    return 1;
  }
}
