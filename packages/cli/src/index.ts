#!/usr/bin/env node
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

const program = new Command();

program.name("closeclaw").description("CloseClaw CLI").version("0.1.0");

program
  .command("onboard")
  .description("Configure CloseClaw bots and gateway")
  .action(async () => {
    try {
      await runOnboard(createOnboardDeps());
    } catch {
      process.exitCode = 1;
    }
  });

const pairing = program
  .command("pairing")
  .description("Manage DM pairing requests");

pairing
  .command("list")
  .description("List pending pairing requests")
  .action(async () => {
    try {
      await runPairingList({
        storePath: join(homedir(), ".closeclaw", "pairing.json"),
      });
    } catch {
      process.exitCode = 1;
    }
  });

pairing
  .command("approve")
  .argument("<code>", "Six-character pairing code")
  .description("Approve a pending pairing request")
  .action(async (code: string) => {
    try {
      await runPairingApprove(code, {
        storePath: join(homedir(), ".closeclaw", "pairing.json"),
      });
    } catch {
      process.exitCode = 1;
    }
  });

const gateway = program.command("gateway").description("Manage the gateway");
gateway
  .command("start")
  .description("Start the gateway")
  .action(async () => {
    try {
      await runGatewayStart(createGatewayStartDeps());
    } catch {
      process.exitCode = 1;
    }
  });

const agent = program.command("agent").description("Configure the AI agent");
agent
  .command("configure")
  .description("Interactive agent provider and model setup")
  .action(async () => {
    try {
      await runAgentConfigure(createAgentConfigureDeps());
    } catch {
      process.exitCode = 1;
    }
  });
agent
  .command("system-prompt")
  .description("View or edit the AI agent system prompt")
  .action(async () => {
    try {
      await runAgentSystemPrompt(createAgentSystemPromptDeps());
    } catch {
      process.exitCode = 1;
    }
  });

void program.parseAsync(process.argv).catch(() => {
  process.exitCode = 1;
});
