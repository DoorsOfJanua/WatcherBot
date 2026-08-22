import { describe, expect, it } from "vitest";

import { mailmanSpiritState } from "./MailmanSpirit";

describe("Mailman spirit motion grammar", () => {
  it("collapses live mascot vocabulary into the eight identity poses", () => {
    expect(mailmanSpiritState("idle", "none")).toBe("idle");
    expect(mailmanSpiritState("listening", "none")).toBe("listening");
    expect(mailmanSpiritState("searching", "none")).toBe("thinking");
    expect(mailmanSpiritState("working", "none")).toBe("working");
    expect(mailmanSpiritState("sleeping", "none")).toBe("sleeping");
    expect(mailmanSpiritState("sad", "none")).toBe("failure");
  });

  it("lets one-shot receipts take precedence over a resting pose", () => {
    expect(mailmanSpiritState("idle", "success")).toBe("success");
    expect(mailmanSpiritState("idle", "failure")).toBe("failure");
    expect(mailmanSpiritState("idle", "working")).toBe("working");
  });
});
