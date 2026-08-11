import { describe, expect, it } from "vitest";
import { searchResultsToRefs } from "../../src/viewer/highlight";

describe("highlight", () => {
  it("converts search results to refs", () => {
    const refs = searchResultsToRefs([
      { pageNumber: 2, spanIndex: 3, span: { text: "x" }, score: 0.5, kind: "semantic" },
    ]);
    expect(refs).toEqual([{ pageNumber: 2, spanIndex: 3 }]);
  });
});