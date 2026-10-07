import { describe, expect, it } from "vitest";
import { takeSentences } from "./sentences";

describe("takeSentences", () => {
  it("splits English sentences and keeps the unfinished tail", () => {
    expect(takeSentences("Hello there. How can I help? I can bo")).toEqual({
      sentences: ["Hello there.", "How can I help?"],
      rest: "I can bo",
    });
  });

  it("splits on the Hindi danda", () => {
    expect(takeSentences("नमस्ते। आप कैसे हैं? कल")).toEqual({
      sentences: ["नमस्ते।", "आप कैसे हैं?"],
      rest: "कल",
    });
  });

  it("does not split after Dr. or inside a time", () => {
    expect(
      takeSentences("Dr. Sarah Mitchell is free at 9.30 tomorrow. "),
    ).toEqual({
      sentences: ["Dr. Sarah Mitchell is free at 9.30 tomorrow."],
      rest: "",
    });
  });

  it("waits for whitespace after a final stop, so the stream end flushes it", () => {
    expect(takeSentences("Booked.")).toEqual({
      sentences: [],
      rest: "Booked.",
    });
  });

  it("treats newlines as boundaries and drops empty lines", () => {
    expect(takeSentences("- 09:00\n\n- 09:30\n- 10")).toEqual({
      sentences: ["- 09:00", "- 09:30"],
      rest: "- 10",
    });
  });
});
