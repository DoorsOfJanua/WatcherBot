import { describe, expect, it } from "vitest";

import {
  botMessageSharesDocument,
  isLocalDocumentPath,
  sharedDocumentHref,
} from "../../shared/shared-document";

describe("shared local document links", () => {
  it("turns supported absolute files into an app-owned document URL", () => {
    const file = "/Users/janua/Projects/FARMADA/needs and wishes.md";
    expect(isLocalDocumentPath(file)).toBe(true);
    expect(sharedDocumentHref(file)).toBe(
      "/api/shared-documents?path=%2FUsers%2Fjanua%2FProjects%2FFARMADA%2Fneeds%20and%20wishes.md",
    );
  });

  it("leaves web, app, relative, and executable links alone", () => {
    for (const link of [
      "https://example.com/report.pdf",
      "/api/attachments/report.pdf",
      "notes/report.md",
      "/Users/janua/run.command",
    ]) {
      expect(sharedDocumentHref(link)).toBe(link);
    }
  });

  it("requires the exact path in a markdown link destination", () => {
    const file = "/Users/janua/Projects/FARMADA/STATE.md";
    expect(botMessageSharesDocument(`[State](${file})`, file)).toBe(true);
    expect(botMessageSharesDocument(`[State](<${file}>)`, file)).toBe(true);
    expect(botMessageSharesDocument(`I read ${file}`, file)).toBe(false);
    expect(botMessageSharesDocument(`[Other](/Users/janua/other.md)`, file)).toBe(false);
  });
});
