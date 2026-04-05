import { select } from "@inquirer/prompts";

export async function selectResetScope(): Promise<"all" | "specific"> {
  return select({
    message: "What would you like to reset?",
    choices: [
      { name: "Reset all configuration", value: "all" },
      { name: "Reset specific platform", value: "specific" },
    ],
  });
}
