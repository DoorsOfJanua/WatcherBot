import { describe, expect, it, vi } from "vitest";

import {
  SIDEBAR_DENSITY_KEY,
  SIDEBAR_ORGANIZATION_KEY,
  loadSidebarDensity,
  loadSidebarOrganization,
  parseSidebarDensity,
  parseSidebarOrganization,
  saveSidebarDensity,
  saveSidebarOrganization,
} from "./sidebar-preferences";

describe("sidebar density preferences", () => {
  it("accepts the three supported layouts and rejects stale values", () => {
    expect(parseSidebarDensity("comfortable")).toBe("comfortable");
    expect(parseSidebarDensity("compact")).toBe("compact");
    expect(parseSidebarDensity("icons")).toBe("icons");
    expect(parseSidebarDensity("tiny")).toBe("comfortable");
    expect(parseSidebarDensity(null)).toBe("comfortable");
  });

  it("loads and saves without making storage availability a launch dependency", () => {
    const setItem = vi.fn();
    saveSidebarDensity("icons", { setItem });
    expect(setItem).toHaveBeenCalledWith(SIDEBAR_DENSITY_KEY, "icons");
    expect(loadSidebarDensity({ getItem: () => "compact" })).toBe("compact");
    expect(loadSidebarDensity({ getItem: () => { throw new Error("blocked"); } })).toBe("comfortable");
  });
});

describe("sidebar organization preferences", () => {
  it("starts with rooms open and no collapsed folders", () => {
    expect(parseSidebarOrganization(null)).toEqual({ roomsCollapsed: false, collapsedFolders: [] });
    expect(parseSidebarOrganization("not-json")).toEqual({ roomsCollapsed: false, collapsedFolders: [] });
  });

  it("keeps only valid unique folder names", () => {
    expect(parseSidebarOrganization(JSON.stringify({
      roomsCollapsed: true,
      collapsedFolders: ["Projects", "Projects", "", 4, "Social"],
    }))).toEqual({ roomsCollapsed: true, collapsedFolders: ["Projects", "Social"] });
  });

  it("loads and saves without depending on browser storage", () => {
    const setItem = vi.fn();
    saveSidebarOrganization({ roomsCollapsed: true, collapsedFolders: ["Life"] }, { setItem });
    expect(setItem).toHaveBeenCalledWith(
      SIDEBAR_ORGANIZATION_KEY,
      JSON.stringify({ roomsCollapsed: true, collapsedFolders: ["Life"] }),
    );
    expect(loadSidebarOrganization({ getItem: () => JSON.stringify({ roomsCollapsed: true, collapsedFolders: ["Work"] }) }))
      .toEqual({ roomsCollapsed: true, collapsedFolders: ["Work"] });
    expect(loadSidebarOrganization({ getItem: () => { throw new Error("blocked"); } }))
      .toEqual({ roomsCollapsed: false, collapsedFolders: [] });
  });
});
