#!/usr/bin/env node
import { homedir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { createOnboardDeps, runOnboard } from "./commands/onboard.js";
import { runPairingList } from "./commands/pairing-list.js";
import { runPairingApprove } from "./commands/pairing-approve.js";

const program = new Command();

program
  .name("closeclaw")
  .description("CloseClaw CLI")
  .version("0.1.0");

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

void program
  .parseAsync(process.argv)
  .catch(() => {
    process.exitCode = 1;
  });
