import { describe, expect, it } from "vitest";

import { addDelightEmoticon } from "./reply-delight.ts";

describe("addDelightEmoticon", () => {
  it("mirrors clear user delight with a restrained marker", () => {
    expect(addDelightEmoticon("Glad that landed.", "Perfect, I love it!"))
      .toBe("Glad that landed. ✨");
    expect(addDelightEmoticon("That was fun.", "haha, nice"))
      .toBe("That was fun. :D");
    expect(addDelightEmoticon("Done.", "Thanks, this works"))
      .toBe("Done. :)");
  });

  it("does not decorate neutral input or an already expressive reply", () => {
    expect(addDelightEmoticon("Here is the report.", "Please send the report"))
      .toBe("Here is the report.");
    expect(addDelightEmoticon("We got it ✨", "Amazing"))
      .toBe("We got it ✨");
    expect(addDelightEmoticon("Nice :) ", "Great"))
      .toBe("Nice :) ");
  });
});
