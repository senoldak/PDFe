import { describe, expect, it, vi } from "vitest";
import type { DocumentCorpus } from "../../src/shared/types";
import { SemanticSearch } from "../../src/engine/search/semantic";

function emb(v: number): number[] {
  return Array.from({ length: 8 }, () => v);
}

vi.mock("@huggingface/transformers", () => {
  const extractor = vi.fn(async (texts: string[]) => ({
    tolist: () => texts.map((t: string) => emb(t.includes("vergi") ? 1 : 0)),
  }));
  return { pipeline: vi.fn().mockResolvedValue(extractor) };
});

describe("SemanticSearch", () => {
  it("returns ranked results matching the query", async () => {
    const corpus: DocumentCorpus = {
      pages: [
        {
          pageNumber: 1,
          text: "vergi dairesi",
          spans: [{ text: "vergi dairesi" }],
          source: "textlayer",
        },
        { pageNumber: 2, text: "market alışverişi", spans: [{ text: "market alışverişi" }], source: "textlayer" },
      ],
      fullText: "vergi dairesi\n\nmarket alışverişi",
    };
    const s = new SemanticSearch();
    await s.init();
    await s.index(corpus);
    const results = await s.search("vergi");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].pageNumber).toBe(1);
  });
  it("returns empty for unindexed corpus", async () => {
    const s = new SemanticSearch();
    await s.init();
    expect(await s.search("x")).toEqual([]);
  });
});
