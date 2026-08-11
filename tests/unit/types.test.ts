import { describe, expect, it } from "vitest";
import type { DocumentCorpus, PageText } from "../../src/shared/types";

describe("shared types", () => {
  it("DocumentCorpus is built from PageText items", () => {
    const page: PageText = {
      pageNumber: 1,
      text: "hello",
      spans: [{ text: "hello", bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } }],
      source: "textlayer",
    };
    const corpus: DocumentCorpus = { pages: [page], fullText: "hello" };
    expect(corpus.pages[0].text).toBe("hello");
    expect(corpus.fullText).toContain("hello");
  });
});