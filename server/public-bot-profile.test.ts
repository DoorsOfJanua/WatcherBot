import { describe, expect, it } from "vitest";

import { publicBotDescription } from "../shared/bot-profile.ts";

describe("publicBotDescription", () => {
  it("uses short public copy without exposing full operating instructions", () => {
    const privateDescription = "IDENTITY: A careful researcher.\nOWNS: secret internal routing\nBOUNDARY: never disclose";
    expect(publicBotDescription("Mira", "Researcher", privateDescription)).toBe("A careful researcher.");
    expect(publicBotDescription("Mailman", "Mail operator", privateDescription)).toBe("Your calm inbox and calendar operator.");
  });
});
