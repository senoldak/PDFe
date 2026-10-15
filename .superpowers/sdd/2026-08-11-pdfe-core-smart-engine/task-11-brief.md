### Task 11: Akıllı Motor — pipeline orkestrasyonu (OCR + korpus + index)

**Files:**
- Create: `src/engine/pipeline.ts`
- Test: `tests/unit/pipeline.test.ts`

**Interfaces:**
- Consumes: `OcrEngine` (Task 8), `SemanticSearch` (Task 9), `buildCorpusFromPages`/`mergeTextAndOcr` (Task 7)
- Produces: `class EnginePipeline { setState(cb: (s: EngineState) => void); run(pages: PDFPageProxy[], opts: { scale: number }): Promise<DocumentCorpus>; search(q): Promise<SearchResult[]>; }` — dijital metin korpusunu kurar, boş sayfaları OCR ile doldurur, embedding index'ler; durum callback'iyle UI'ya `EngineState` bildirir.

- [ ] **Step 1: src/engine/pipeline.ts yaz**

```ts
import type { PDFPageProxy } from "pdfjs-dist";
import type { DocumentCorpus, EngineState, PageText, SearchResult } from "../shared/types";
import { buildCorpusFromPages, corpusHasText } from "./text/corpus";
import { mergeTextAndOcr } from "./text/merge";
import { OcrEngine } from "./ocr/ocr";
import { SemanticSearch } from "./search/semantic";

export interface PipelineDeps {
  ocr: OcrEngine;
  semantic: SemanticSearch;
  ocrLangPath: string;
  ocrCorePath: string;
  ocrWorkerPath: string;
}

export class EnginePipeline {
  private corpus: DocumentCorpus | null = null;
  private stateCb: ((s: EngineState) => void) | null = null;
  private deps: PipelineDeps;

  constructor(deps: PipelineDeps) {
    this.deps = deps;
  }

  setState(cb: (s: EngineState) => void): void {
    this.stateCb = cb;
  }

  private emit(s: Partial<EngineState>): void {
    this.stateCb?.({ ocr: "idle", ocrProgress: 0, corpusReady: false, searchReady: false, ...s });
  }

  async run(pages: PDFPageProxy[], opts: { scale: number }): Promise<DocumentCorpus> {
    this.emit({ ocr: "idle", ocrProgress: 0 });

    const textLayerPages: PageText[] = [];
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const textContent = await page.getTextContent();
      const spans = textContent.items
        .filter((it: any) => typeof it.str === "string" && it.str.trim())
        .map((it: any) => ({ text: it.str as string }));
      textLayerPages.push({
        pageNumber: i + 1,
        text: spans.map((s) => s.text).join(" "),
        spans,
        source: "textlayer",
      });
    }

    const preliminary = buildCorpusFromPages(textLayerPages);
    let finalPages = textLayerPages;

    if (!corpusHasText(preliminary)) {
      this.emit({ ocr: "loading", ocrProgress: 0.05 });
      await this.deps.ocr.init();
      const ocrPages: PageText[] = [];
      for (let i = 0; i < pages.length; i++) {
        const canvas = document.createElement("canvas");
        const viewport = pages[i].getViewport({ scale: opts.scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await pages[i].render({ canvasContext: ctx, viewport }).promise;
        const out = await this.deps.ocr.recognizePage(canvas, i + 1);
        ocrPages.push(out);
        this.emit({ ocr: "running", ocrProgress: (i + 1) / pages.length });
      }
      await this.deps.ocr.terminate();
      finalPages = mergeTextAndOcr(textLayerPages, ocrPages);
    }

    const corpus = buildCorpusFromPages(finalPages);
    this.corpus = corpus;
    this.emit({ ocr: "done", ocrProgress: 1, corpusReady: true });

    if (corpusHasText(corpus)) {
      await this.deps.semantic.init();
      await this.deps.semantic.index(corpus);
      this.emit({ searchReady: true });
    }
    return corpus;
  }

  async search(query: string): Promise<SearchResult[]> {
    if (!this.corpus) return [];
    return this.deps.semantic.search(query);
  }
}
```

- [ ] **Step 2: tests/unit/pipeline.test.ts yaz**

```ts
import { describe, expect, it, vi } from "vitest";
import { EnginePipeline } from "../../src/engine/pipeline";
import { OcrEngine } from "../../src/engine/ocr/ocr";
import { SemanticSearch } from "../../src/engine/search/semantic";
import type { DocumentCorpus, PageText } from "../../src/shared/types";

function mockPage(text: string): any {
  return {
    getTextContent: vi.fn().mockResolvedValue({
      items: text.split(/\s+/).filter(Boolean).map((s) => ({ str: s })),
    }),
    getViewport: vi.fn().mockReturnValue({ width: 100, height: 200, scale: 1 }),
    render: vi.fn().mockResolvedValue({ promise: Promise.resolve() }),
  };
}

function fakeOcr(): OcrEngine {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    recognizePage: vi.fn().mockImplementation(async (_c, n) => ({ pageNumber: n, text: `ocr${n}`, spans: [], source: "ocr" }) as PageText),
    terminate: vi.fn().mockResolvedValue(undefined),
    setProgress: vi.fn(),
  } as unknown as OcrEngine;
}

function fakeSemantic(): SemanticSearch {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    index: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
  } as unknown as SemanticSearch;
}

describe("EnginePipeline", () => {
  it("builds corpus from digital text without OCR", async () => {
    const pipeline = new EnginePipeline({
      ocr: fakeOcr(),
      semantic: fakeSemantic(),
      ocrLangPath: "/", ocrCorePath: "/", ocrWorkerPath: "/",
    });
    const states: any[] = [];
    pipeline.setState((s) => states.push(s));
    const corpus = await pipeline.run([mockPage("merhaba dunya")], { scale: 1 });
    expect(corpus.fullText).toContain("merhaba");
    expect((pipeline as any).deps.ocr.init).not.toHaveBeenCalled();
    expect(states.some((s) => s.corpusReady)).toBe(true);
  });

  it("falls back to OCR when text is empty", async () => {
    const ocr = fakeOcr();
    const pipeline = new EnginePipeline({
      ocr,
      semantic: fakeSemantic(),
      ocrLangPath: "/", ocrCorePath: "/", ocrWorkerPath: "/",
    });
    const corpus = await pipeline.run([mockPage("   ") as any], { scale: 1 });
    expect(ocr.init).toHaveBeenCalled();
    expect(corpus.fullText).toContain("ocr1");
  });
});
```
> Not: `document.createElement` jsdom'da mevcuttur. `mockPage(" ")` metinsiz; `spans` boş olur, `preliminary.fullText` boş → OCR yolu tetiklenir.

- [ ] **Step 3: test + typecheck + build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/engine/pipeline.ts tests/unit/pipeline.test.ts
git commit -m "feat: orchestrate OCR, corpus and semantic index in pipeline"
```

---