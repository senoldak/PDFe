### Task 9: Akıllı Motor — anlamsal arama (transformers.js embedding)

**Files:**
- Create: `src/engine/search/semantic.ts`
- Test: `tests/unit/semantic.test.ts`

**Interfaces:**
- Consumes: `pipeline("feature-extraction", ...)`; `DocumentCorpus`, `SearchResult` (Task 2)
- Produces: `class SemanticSearch { init(): Promise<void>; index(corpus: DocumentCorpus): Promise<void>; search(query: string, topK?: number): Promise<SearchResult[]> }` — cümle bazlı embedding, cosine benzerliği.

- [ ] **Step 1: src/engine/search/semantic.ts yaz**

```ts
import { pipeline } from "@huggingface/transformers";
import type { DocumentCorpus, SearchResult, TextSpan } from "../../shared/types";

const MODEL = "Xenova/all-MiniLM-L6-v2";

type FeatureExtractionPipeline = (texts: string[], opts?: { pooling?: string; normalize?: boolean }) => Promise<{ tolist(): number[][] }>;

interface IndexedSentence {
  pageNumber: number;
  spanIndex: number;
  text: string;
  embedding: number[];
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export class SemanticSearch {
  private extractor: FeatureExtractionPipeline | null = null;
  private index: IndexedSentence[] = [];

  async init(): Promise<void> {
    this.extractor = (await pipeline("feature-extraction", MODEL, { dtype: "q8" })) as unknown as FeatureExtractionPipeline;
  }

  async index(corpus: DocumentCorpus): Promise<void> {
    if (!this.extractor) throw new Error("SemanticSearch not initialized");
    this.index = [];
    const sentences: { pageNumber: number; spanIndex: number; text: string }[] = [];
    for (const page of corpus.pages) {
      page.spans.forEach((span, i) => {
        const t = span.text.trim();
        if (t.length > 1) sentences.push({ pageNumber: page.pageNumber, spanIndex: i, text: t });
      });
    }
    if (!sentences.length) return;
    const chunks: string[][] = [];
    for (let i = 0; i < sentences.length; i += 64) {
      chunks.push(sentences.slice(i, i + 64).map((s) => s.text));
    }
    for (let c = 0; c < chunks.length; c++) {
      const out = await this.extractor!(chunks[c], { pooling: "mean", normalize: true });
      const rows = out.tolist();
      rows.forEach((emb, j) => {
        const s = sentences[c * 64 + j];
        this.index.push({ pageNumber: s.pageNumber, spanIndex: s.spanIndex, text: s.text, embedding: emb });
      });
    }
  }

  async search(query: string, topK = 5): Promise<SearchResult[]> {
    if (!this.extractor) throw new Error("SemanticSearch not initialized");
    if (!this.index.length) return [];
    const [qEmb] = (await this.extractor([query], { pooling: "mean", normalize: true })).tolist();
    const scored = this.index
      .map((s) => ({ ...s, score: cosine(qEmb, s.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return scored.map((s): SearchResult => ({
      pageNumber: s.pageNumber,
      spanIndex: s.spanIndex,
      span: { text: s.text } as TextSpan,
      score: s.score,
      kind: "semantic",
    }));
  }
}
```

- [ ] **Step 2: tests/unit/semantic.test.ts yaz** — pipeline mock'lu (deterministik embedding)

```ts
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
```

- [ ] **Step 3: test + typecheck + build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/engine/search tests/unit/semantic.test.ts
git commit -m "feat: add local semantic search with transformers.js embeddings"
```

---