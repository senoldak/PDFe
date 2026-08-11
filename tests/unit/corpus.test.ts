import { describe, expect, it } from "vitest";
import { buildCorpusFromPages, corpusHasText } from "../../src/engine/text/corpus";
import { mergeTextAndOcr } from "../../src/engine/text/merge";
import type { PageText } from "../../src/shared/types";

function page(n: number, text: string): PageText {
  return { pageNumber: n, text, spans: text.split(/\s+/).filter(Boolean).map((t) => ({ text: t })), source: "textlayer" };
}

describe("corpus", () => {
  it("sorts pages and joins full text", () => {
    const c = buildCorpusFromPages([page(2, "iki"), page(1, "bir")]);
    expect(c.pages[0].pageNumber).toBe(1);
    expect(c.fullText).toBe("bir\n\niki");
  });
  it("detects empty corpus", () => {
    expect(corpusHasText(buildCorpusFromPages([]))).toBe(false);
  });
  it("merge fills empty textlayer pages from ocr", () => {
    const merged = mergeTextAndOcr([page(1, "dijital"), page(2, "")], [page(2, "taranmış")]);
    expect(merged.find((p) => p.pageNumber === 2)!.text).toBe("taranmış");
    expect(merged.find((p) => p.pageNumber === 2)!.source).toBe("ocr");
  });
  it("merge keeps digital text when ocr also exists", () => {
    const merged = mergeTextAndOcr([page(1, "dijital")], [page(1, "ocr çıktısı")]);
    expect(merged.find((p) => p.pageNumber === 1)!.text).toBe("dijital");
  });
});
