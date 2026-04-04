#!/usr/bin/env node
import { Command } from "commander";
import { createOnboardDeps, runOnboard } from "./commands/onboard.js";

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

void program
  .parseAsync(process.argv)
  .catch(() => {
    process.exitCode = 1;
  });
