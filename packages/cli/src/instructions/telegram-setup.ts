export function getTelegramInstructions(): string {
  return [
    "Telegram bot setup:",
    "1. Open Telegram and search for @BotFather",
    "2. Send the command /newbot",
    "3. Choose a display name for your bot",
    "4. Choose a username that ends in bot",
    "5. Copy the bot token BotFather sends you",
  ].join("\n");
}
