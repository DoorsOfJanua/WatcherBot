import { describe, expect, it } from "vitest";

import {
  latestMissionOutcome,
  missionProgress,
  monitorInterval,
  relativeTime,
  type MissionSummary,
} from "./autonomy";

const mission = (workItems: MissionSummary["workItems"]): MissionSummary => ({
  id: "mission-1",
  title: "Finish Volume 1",
  leadAgentId: "ganga",
  ownerThreadId: "thread-1",
  objective: "Find the path to a finished book.",
  status: "running",
  workItems,
  createdAt: 1,
  updatedAt: 2,
});

describe("autonomy presentation helpers", () => {
  it("summarizes mission progress without treating blocked work as complete", () => {
    expect(missionProgress(mission([
      { id: "a", title: "Inventory", status: "completed", attempts: 1, updatedAt: 2 },
      { id: "b", title: "Resolve gaps", status: "blocked", attempts: 1, updatedAt: 3 },
      { id: "c", title: "Assemble", status: "pending", attempts: 0, updatedAt: 1 },
    ]))).toEqual({ completed: 1, total: 3, percent: 33 });
  });

  it("selects the newest result or error as the mission outcome", () => {
    const latest = latestMissionOutcome(mission([
      { id: "a", title: "First", status: "completed", attempts: 1, result: "Old result", updatedAt: 20, completedAt: 20 },
      { id: "b", title: "Second", status: "blocked", attempts: 1, error: "Needs a source", updatedAt: 30 },
    ]));
    expect(latest?.id).toBe("b");
  });

  it("keeps schedules and relative timestamps compact", () => {
    const now = new Date("2026-08-26T12:00:00Z").getTime();
    expect(monitorInterval(360)).toBe("Every 6 hours");
    expect(monitorInterval(1_440)).toBe("Every day");
    expect(relativeTime(now + 30 * 60_000, now)).toBe("in 30 min");
    expect(relativeTime(now - 2 * 60 * 60_000, now)).toBe("2 hr ago");
  });
});

