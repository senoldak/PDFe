import { describe, expect, it } from "vitest";
import { searchResultsToRefs, highlightSpans } from "../../src/viewer/highlight";
import { findInSpans } from "../../src/viewer/findBar";

describe("highlight", () => {
  it("converts search results to refs", () => {
    const refs = searchResultsToRefs([
      { pageNumber: 2, spanIndex: 3, span: { text: "x" }, score: 0.5, kind: "semantic" },
    ]);
    expect(refs).toEqual([{ pageNumber: 2, spanIndex: 3 }]);
  });
  it("highlights the correct span on page 2 from flattened find results", () => {
    const pageSpans = [["a", "b", "needle", "d"], ["e", "needle", "f"]];
    const containers = pageSpans.map((spans) => {
      const page = document.createElement("div");
      const layer = document.createElement("div");
      layer.className = "textLayer";
      page.appendChild(layer);
      for (const t of spans) {
        const span = document.createElement("span");
        span.textContent = t;
        layer.appendChild(span);
      }
      return page;
    });
    const flattened = containers.flatMap((page, i) =>
      [...page.querySelectorAll(".textLayer span")].map((s) => ({ text: s.textContent!, pageNumber: i + 1 }))
    );
    const results = findInSpans(flattened, "needle");
    const count = highlightSpans(
      containers,
      results.map((r) => ({ pageNumber: r.pageNumber, spanIndex: r.spanIndex }))
    );
    expect(count).toBe(2);
    expect(containers[0].querySelectorAll(".textLayer span")[2].classList.contains("pdfe-highlight")).toBe(true);
    expect(containers[1].querySelectorAll(".textLayer span")[1].classList.contains("pdfe-highlight")).toBe(true);
    expect(containers[1].querySelectorAll(".textLayer span")[0].classList.contains("pdfe-highlight")).toBe(false);
  });
});