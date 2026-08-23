// composeMessage with images, the image tag round-trip through
// splitAttachedImages, and the mime gate the composer pastes through.
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachmentBasename,
  composeMessage,
  fileAttachmentFromFile,
  isImageFile,
  splitAttachedImages,
  type ImageAttachment,
} from "./composer-attachments";

afterEach(() => vi.unstubAllGlobals());

const image = (path: string): ImageAttachment => ({
  kind: "image",
  id: "i1",
  path,
  name: "shot.png",
  size: 1234,
  mime: "image/png",
});

describe("composeMessage with images", () => {
  it("emits an attached-image tag carrying the server path", () => {
    const prompt = composeMessage("what is this?", [image("/home/u/.openmausbot/attachments/abc.png")]);
    expect(prompt).toBe(
      'what is this?\n\n<attached-image path="/home/u/.openmausbot/attachments/abc.png" />',
    );
  });

  it("escapes a hostile path the same way file paths are escaped", () => {
    const prompt = composeMessage("", [image('/x/")} onload="evil()')]);
    // every quote is entity-encoded, so the payload can never break out of
    // the attribute — the tag stays one well-formed element
    expect(prompt).toMatch(/<attached-image path="[^"]*" \/>/);
    expect(prompt).toContain("&quot;");
  });
});

describe("splitAttachedImages", () => {
  it("splits tags out of a stored message and returns the paths", () => {
    const stored =
      'look at this\n\n<attached-image path="/a/b/one.png" />\n\n<attached-image path="/a/b/two.jpg" />';
    const { display, images } = splitAttachedImages(stored);
    expect(display).toBe("look at this");
    expect(images).toEqual(["/a/b/one.png", "/a/b/two.jpg"]);
  });

  it("unescapes attribute entities so the path round-trips", () => {
    const stored = '<attached-image path="/a/b/&amp;x.png" />';
    const { images } = splitAttachedImages(stored);
    expect(images).toEqual(["/a/b/&x.png"]);
  });

  it("leaves plain text and other tags untouched", () => {
    const stored = '<pasted-text index="1">\nhi\n</pasted-text>';
    const { display, images } = splitAttachedImages(stored);
    expect(display).toBe(stored);
    expect(images).toEqual([]);
  });
});

describe("attachmentBasename", () => {
  it("takes the final path segment on POSIX and Windows separators", () => {
    expect(attachmentBasename("/a/b/c.png")).toBe("c.png");
    expect(attachmentBasename("C:\\a\\b\\c.png")).toBe("c.png");
  });
});

describe("isImageFile", () => {
  it("accepts the served image mimes and rejects others", () => {
    expect(isImageFile({ type: "image/png", size: 10 })).toBe(true);
    expect(isImageFile({ type: "image/jpeg", size: 10 })).toBe(true);
    expect(isImageFile({ type: "image/webp", size: 10 })).toBe(true);
    expect(isImageFile({ type: "image/svg+xml", size: 10 })).toBe(false);
    expect(isImageFile({ type: "text/plain", size: 10 })).toBe(false);
  });
});

describe("fileAttachmentFromFile", () => {
  it("keeps the existing path in the desktop shell without uploading", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const file = new File(["hello"], "notes.md", { type: "text/markdown" });
    const attachment = await fileAttachmentFromFile(file, () => "/Users/janua/notes.md");
    expect(attachment).toMatchObject({ kind: "file", name: "notes.md", path: "/Users/janua/notes.md" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uploads a phone/browser file and returns the host-readable path", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ path: "/host/attachments/abc.pdf", bytes: 5 }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const file = new File(["hello"], "My brief.pdf", { type: "application/pdf" });
    const attachment = await fileAttachmentFromFile(file);
    expect(attachment).toMatchObject({ kind: "file", name: "My brief.pdf", path: "/host/attachments/abc.pdf", size: 5 });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/file-attachments",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-attachment-filename": "My%20brief.pdf" }),
      }),
    );
  });
});
