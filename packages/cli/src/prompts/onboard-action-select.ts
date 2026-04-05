import { select } from "@inquirer/prompts";

export type OnboardExistingAction = "add-integration" | "reset-configuration";

export async function selectOnboardExistingAction(): Promise<OnboardExistingAction> {
  return select<OnboardExistingAction>({
    message: "What would you like to do?",
    choices: [
      { name: "Add new integration", value: "add-integration" },
      { name: "Reset configuration", value: "reset-configuration" },
    ],
  });
}
