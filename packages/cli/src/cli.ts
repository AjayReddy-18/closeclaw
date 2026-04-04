import { homedir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { createOnboardDeps, runOnboard } from "./commands/onboard.js";
import { runPairingList } from "./commands/pairing-list.js";
import { runPairingApprove } from "./commands/pairing-approve.js";

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
  pairing
    .command("list")
    .action(async () => {
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
  try {
    await program.parseAsync(argv);
    return 0;
  } catch {
    return 1;
  }
}
