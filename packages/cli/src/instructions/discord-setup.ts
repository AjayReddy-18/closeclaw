export function getDiscordInstructions(): string {
  return [
    "Discord bot setup:",
    "1. Open the Discord Developer Portal at https://discord.com/developers/applications",
    "2. Click New Application and name it",
    "3. Open the Bot section in the left sidebar",
    "4. Click Reset Token or Copy to obtain the bot token",
    "5. Under Privileged Gateway Intents enable Message Content Intent",
  ].join("\n");
}
