import { Command } from "commander";
import { createOnboardDeps, runOnboard } from "./commands/onboard.js";

export async function runCli(argv: string[]): Promise<number> {
  const program = new Command();
  program.name("closeclaw");
  program
    .command("onboard")
    .description("Run interactive onboarding")
    .action(async () => {
      await runOnboard(createOnboardDeps());
    });
  try {
    await program.parseAsync(argv);
    return 0;
  } catch {
    return 1;
  }
}
