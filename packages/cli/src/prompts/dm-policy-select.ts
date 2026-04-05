import { select } from "@inquirer/prompts";
import {
  DmPolicy,
  type DmPolicy as DmPolicyValue,
} from "@closeclaw/shared-types";

export async function selectDmPolicy(): Promise<DmPolicyValue> {
  return select({
    message: "DM access policy",
    default: DmPolicy.PAIRING,
    choices: [
      {
        name: "Pairing (recommended)",
        value: DmPolicy.PAIRING,
        description: "New users must complete pairing before DMs are accepted",
      },
      {
        name: "Allowlist",
        value: DmPolicy.ALLOWLIST,
        description: "Only listed user IDs may send DMs",
      },
      {
        name: "Open",
        value: DmPolicy.OPEN,
        description: "Warning: any user can DM the bot without pairing",
      },
    ],
  });
}
