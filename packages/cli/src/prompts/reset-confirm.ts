import { confirm } from "@inquirer/prompts";

export async function confirmReset(message: string): Promise<boolean> {
  return confirm({ message, default: false });
}
