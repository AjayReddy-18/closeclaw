import { describe, it, expect } from "vitest";
import { conversationKey } from "@closeclaw/ai-agent";
import type { ConversationRole } from "@closeclaw/ai-agent";
import { BotPlatform } from "@closeclaw/shared-types";

describe("conversationKey", () => {
  it('returns "platform:senderId" for telegram', () => {
    expect(conversationKey(BotPlatform.TELEGRAM, "user-1")).toBe(
      "telegram:user-1",
    );
  });

  it('returns "platform:senderId" for discord', () => {
    expect(conversationKey(BotPlatform.DISCORD, "456")).toBe("discord:456");
  });
});

describe("ConversationRole", () => {
  it("accepts system, user, assistant, and tool as string literals", () => {
    const roles: ConversationRole[] = ["system", "user", "assistant", "tool"];
    expect(roles).toEqual(["system", "user", "assistant", "tool"]);
  });
});
