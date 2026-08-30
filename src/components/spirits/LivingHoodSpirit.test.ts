import { describe, expect, it } from "vitest";

import { poseForSpirit, transitionFrames } from "./LivingHoodSpirit";

describe("agent spirit personality", () => {
  it("gives the same event a distinct personality", () => {
    expect(poseForSpirit({ spirit: "mailman", state: "idle", reaction: "customize" })).toEqual({
      mood: "love",
      heading: "up",
    });
    expect(poseForSpirit({ spirit: "sensei", state: "idle", reaction: "customize" })).toEqual({
      mood: "happy",
      heading: "down",
    });
    expect(poseForSpirit({ spirit: "signal", state: "idle", reaction: "blink" })).toEqual({
      mood: "suspicious",
      heading: "right",
    });
  });

  it("moves through each spirit's authored idle sequence", () => {
    expect(poseForSpirit({ spirit: "wormhole", state: "idle", idleBeat: 0 })).toEqual({
      mood: "open",
      heading: "center",
    });
    expect(poseForSpirit({ spirit: "wormhole", state: "idle", idleBeat: 1 })).toEqual({
      mood: "suspicious",
      heading: "left",
    });
    expect(poseForSpirit({ spirit: "watcher", state: "idle", idleBeat: 1 })).toEqual({
      mood: "open",
      heading: "left",
    });
    expect(poseForSpirit({ spirit: "mailman", state: "idle", idleBeat: 2 })).toEqual({
      mood: "wink",
      heading: "right",
    });
  });

  it("uses semantic work state when there is no transient reaction", () => {
    expect(poseForSpirit({ spirit: "forge", state: "working" })).toEqual({
      mood: "focused",
      heading: "down",
    });
  });

  it("lets an emotional range reshape idle and reaction poses without obscuring work", () => {
    expect(poseForSpirit({ spirit: "sensei", state: "idle", idleBeat: 0, temperament: "playful" })).toEqual({
      mood: "wink",
      heading: "right",
    });
    expect(poseForSpirit({ spirit: "mailman", state: "idle", reaction: "blink", temperament: "fierce" })).toEqual({
      mood: "suspicious",
      heading: "right",
    });
    expect(poseForSpirit({ spirit: "ganga", state: "working", temperament: "expressive" })).toEqual({
      mood: "focused",
      heading: "down",
    });
    expect(poseForSpirit({ spirit: "wormhole", state: "idle", temperament: "mystic" })).toEqual({
      mood: "awe",
      heading: "up",
    });
    expect(poseForSpirit({ spirit: "forge", state: "idle", idleBeat: 1, temperament: "mischievous" })).toEqual({
      mood: "wink",
      heading: "left",
    });
  });

  it("softens and blinks before revealing a new face and heading", () => {
    expect(
      transitionFrames(
        { mood: "angry", heading: "left" },
        { mood: "love", heading: "up" },
      ),
    ).toEqual([
      { mood: "calm", heading: "left" },
      { mood: "closed", heading: "up" },
      { mood: "love", heading: "up" },
    ]);
  });
});
