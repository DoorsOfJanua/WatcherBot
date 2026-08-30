import { describe, expect, it } from "vitest";

import { AGENT_ROLE_TEMPLATES } from "../shared/agent-role-templates.ts";

describe("agent role templates", () => {
  it("keeps every optional role unique and within the bot profile contract", () => {
    expect(AGENT_ROLE_TEMPLATES).toHaveLength(21);
    expect(new Set(AGENT_ROLE_TEMPLATES.map((template) => template.id)).size).toBe(21);
    for (const template of AGENT_ROLE_TEMPLATES) {
      expect(template.title.length).toBeLessThanOrEqual(200);
      expect(template.description.length).toBeLessThanOrEqual(4_000);
      expect(template.description).toContain("OWNS\n");
      expect(template.description).toContain("GOOD LOOKS LIKE\n");
      expect(template.description).toContain("BOUNDARY\n");
      expect(template.description).toContain("WHEN UNSURE\n");
      expect(template.description).toContain("LOG\n");
    }
  });

  it("keeps sensitive external-action roles explicitly bounded", () => {
    const byId = Object.fromEntries(AGENT_ROLE_TEMPLATES.map((template) => [template.id, template.description]));
    expect(byId["inbox-triage"]).toContain("Never send");
    expect(byId["support-draft"]).toContain("Never send");
    expect(byId["reproduction-specialist"]).toContain("Never touch production");
    expect(byId["support-organizer"]).toContain("Never send a reply");
    expect(byId["analytics-investigator"]).toContain("Never change dashboards");
    expect(byId["documentation-tracker"]).toContain("Never edit or publish documentation");
    expect(byId["social-publisher"]).toContain("Never publish");
    expect(byId.ledger).toContain("Never pay");
    expect(byId.builder).toContain("Never discard dirty-tree changes");
  });
});
