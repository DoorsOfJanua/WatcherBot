import { describe, expect, it } from "vitest";

import type { Bot } from "@/state/store";
import { workingPhrase } from "./work-language";

const bot = (name: string, spirit?: Bot["spirit"]): Bot => ({
  id: name.toLowerCase(),
  threadId: `${name}-thread`,
  name,
  title: "",
  description: "",
  notifications: true,
  color: "green",
  spirit,
  unread: false,
  modelSelection: { instanceId: "fixture", model: "default" },
  messages: [],
});

describe("agent work language", () => {
  it("gives named roles their own local vocabulary", () => {
    expect(["Chopping wood…", "Carrying water…", "Sharpening the blade…"]).toContain(
      workingPhrase(bot("Sensei", "sensei"), "one"),
    );
    expect(["Reading the room…", "Bending the trend…", "Preparing the signal…"]).toContain(
      workingPhrase({ ...bot("Pulse"), title: "Social media and trends" }, "one"),
    );
  });

  it("is stable for the same agent and activity group", () => {
    const forge = bot("Forge", "forge");
    expect(workingPhrase(forge, "group-a")).toBe(workingPhrase(forge, "group-a"));
  });
});
