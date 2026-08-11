import { describe, expect, it } from "vitest";
import { findInSpans } from "../../src/viewer/findBar";

describe("findInSpans", () => {
  const spans = [{ text: "Vergi dairesi" }, { text: "Tutar: 1200 TL" }, { text: "vergi" }];
  it("finds literal matches case-insensitively", () => {
    const r = findInSpans(spans, "vergi");
    expect(r.length).toBe(2);
  });
  it("supports regex when flag is set", () => {
    const r = findInSpans(spans, "Tutar[^\\d]*(\\d+)", true);
    expect(r.length).toBe(1);
  });
  it("returns empty for empty query", () => {
    expect(findInSpans(spans, "")).toEqual([]);
  });
  it("treats invalid regex as no results", () => {
    expect(findInSpans(spans, "(", true)).toEqual([]);
  });
});