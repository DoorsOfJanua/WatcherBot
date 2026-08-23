import { describe, expect, it } from "vitest";

import { agentSpiritForBot } from "./agent-spirit-identity";

describe("agentSpiritForBot", () => {
  it("keeps identity after a visible rename", () => {
    expect(agentSpiritForBot({ name: "Fast one", sharedMemoryId: "mailroom" })).toBe("mailman");
    expect(agentSpiritForBot({ name: "Master", sharedMemoryId: "coach" })).toBe("sensei");
  });

  it("recognizes the core roster before shared memory is configured", () => {
    expect(agentSpiritForBot({ name: " Wormhole " })).toBe("wormhole");
    expect(agentSpiritForBot({ name: " The Watcher " })).toBe("wormhole");
    expect(agentSpiritForBot({ name: "GANGA" })).toBe("ganga");
  });

  it("does not assign a borrowed identity to a custom agent", () => {
    expect(agentSpiritForBot({ name: "Finance" })).toBeNull();
  });
});
