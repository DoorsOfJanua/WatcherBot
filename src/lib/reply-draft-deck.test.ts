import { describe, expect, it } from "vitest";
import { parseReplyDraftBatch } from "./reply-draft-deck";

describe("reply draft deck", () => {
  it("accepts a compact batch of exact pending drafts", () => {
    expect(parseReplyDraftBatch(JSON.stringify({
      profileId: "cryptocat-btc",
      agentId: "fllow-agent",
      items: [{ id: "draft-1", author: "@alice", post: "the original post", reply: "the reply" }],
    }))).toEqual({
      profileId: "cryptocat-btc",
      agentId: "fllow-agent",
      title: "1 replies ready",
      items: [{ id: "draft-1", author: "alice", post: "the original post", reply: "the reply" }],
    });
  });

  it("rejects malformed, duplicate, and oversized batches", () => {
    expect(parseReplyDraftBatch("not json")).toBeNull();
    expect(parseReplyDraftBatch(JSON.stringify({ profileId: "p", items: [] }))).toBeNull();
    expect(parseReplyDraftBatch(JSON.stringify({
      profileId: "p",
      items: [
        { id: "same", author: "a", post: "p", reply: "r" },
        { id: "same", author: "b", post: "p", reply: "r" },
      ],
    }))).toBeNull();
  });
});

