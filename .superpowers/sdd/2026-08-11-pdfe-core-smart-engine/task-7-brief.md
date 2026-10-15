### Task 7: Akıllı Motor — korpus üretimi (text layer birleştirme)

**Files:**
- Create: `src/engine/text/corpus.ts`
- Create: `src/engine/text/merge.ts`
- Test: `tests/unit/corpus.test.ts`

**Interfaces:**
- Consumes: `PageText` (Task 2)
- Produces: `buildCorpusFromPages(pages: PageText[]): DocumentCorpus`, `mergeTextAndOcr(textLayer: PageText[], ocr: PageText[]): PageText[]` — aynı sayfa için OCR çıktısı varsa text layer'ı tamamlar (boş sayfaları doldurur).

- [ ] **Step 1: src/engine/text/corpus.ts yaz**

```ts
import type { DocumentCorpus, PageText } from "../../shared/types";

export function buildCorpusFromPages(pages: PageText[]): DocumentCorpus {
  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  return {
    pages: sorted,
    fullText: sorted.map((p) => p.text).join("\n\n"),
  };
}

export function corpusHasText(corpus: DocumentCorpus): boolean {
  return corpus.fullText.trim().length > 0;
}
```

- [ ] **Step 2: src/engine/text/merge.ts yaz**

```ts
import type { PageText } from "../../shared/types";

export function mergeTextAndOcr(textLayer: PageText[], ocr: PageText[]): PageText[] {
  const ocrByPage = new Map(ocr.map((p) => [p.pageNumber, p]));
  const out: PageText[] = [];
  for (const page of textLayer) {
    const ocrPage = ocrByPage.get(page.pageNumber);
    if (page.text.trim().length === 0 && ocrPage && ocrPage.text.trim().length > 0) {
      out.push({ ...ocrPage, source: "ocr" });
    } else {
      out.push(page);
    }
  }
  for (const p of ocr) {
    if (!textLayer.some((t) => t.pageNumber === p.pageNumber)) out.push(p);
  }
  return out.sort((a, b) => a.pageNumber - b.pageNumber);
}
```

- [ ] **Step 3: tests/unit/corpus.test.ts yaz**

```ts
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
```

- [ ] **Step 4: test + typecheck + build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine tests/unit/corpus.test.ts
git commit -m "feat: build unified document corpus from text layer and OCR"
```

---