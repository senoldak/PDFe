### Task 8: Akıllı Motor — OCR modülü (Tesseract.js)

**Files:**
- Create: `src/engine/ocr/ocr.ts`
- Test: `tests/unit/ocr.test.ts`

**Interfaces:**
- Consumes: Tesseract `createWorker`; `Bbox` (Task 2)
- Produces: `class OcrEngine { init(): Promise<void>; recognizePage(canvas: HTMLCanvasElement, pageNumber: number): Promise<PageText>; setProgress(cb: (p: number) => void): void; terminate(): Promise<void> }` — `langPath` = `chrome.runtime.getURL("models/tessdata")`, worker/core `node_modules`'tan kopyalanan dosyalara (build sonrası `dist/` içinde) işaret eder.

- [ ] **Step 1: src/engine/ocr/ocr.ts yaz**

```ts
import { createWorker, type Worker } from "tesseract.js";
import type { Bbox, PageText, TextSpan } from "../../shared/types";

export interface OcrOptions {
  langPath: string;
  corePath: string;
  workerPath: string;
  lang: string;
}

export class OcrEngine {
  private worker: Worker | null = null;
  private progressCb: ((p: number) => void) | null = null;
  private options: OcrOptions;

  constructor(options: OcrOptions) {
    this.options = options;
  }

  setProgress(cb: (p: number) => void): void {
    this.progressCb = cb;
  }

  async init(): Promise<void> {
    this.worker = await createWorker(this.options.lang, 1, {
      langPath: this.options.langPath,
      corePath: this.options.corePath,
      workerPath: this.options.workerPath,
      logger: (m) => {
        if (m.status === "recognizing text" && this.progressCb) {
          this.progressCb(m.progress);
        }
      },
    });
  }

  async recognizePage(canvas: HTMLCanvasElement, pageNumber: number): Promise<PageText> {
    if (!this.worker) throw new Error("OcrEngine not initialized");
    const { data } = await this.worker.recognize(canvas, {}, { text: true, blocks: true });
    const spans: TextSpan[] = [];
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        for (const line of para.lines ?? []) {
          for (const word of line.words ?? []) {
            const b = word.bbox as Bbox;
            spans.push({ text: word.text, bbox: b, confidence: word.confidence });
          }
        }
      }
    }
    return {
      pageNumber,
      text: data.text,
      spans,
      source: "ocr",
    };
  }

  async terminate(): Promise<void> {
    await this.worker?.terminate();
    this.worker = null;
  }
}
```

- [ ] **Step 2: OCR dosyalarını build'e kopyala** — `scripts/copy-static.mjs`'ye tesseract worker + core dosyalarını ekle

Modify `scripts/copy-static.mjs`:
```js
const tessDir = resolve(root, "node_modules/tesseract.js/dist");
if (existsSync(tessDir)) cpSync(tessDir, resolve(dist, "tesseract"), { recursive: true });
const coreDir = resolve(root, "node_modules/tesseract.js-core");
if (existsSync(coreDir)) cpSync(coreDir, resolve(dist, "tesseract-core"), { recursive: true });
```
`chrome.runtime.getURL` ile erişim için `manifest.json` `web_accessible_resources`'a `"tesseract/*"`, `"tesseract-core/*"` ekle.

- [ ] **Step 3: tests/unit/ocr.test.ts yaz** — worker mock'lu (gerçek OCR CI'da yavaş/kırılgan; mantığı test et)

```ts
import { describe, expect, it, vi } from "vitest";
import { OcrEngine } from "../../src/engine/ocr/ocr";

vi.mock("tesseract.js", () => {
  const recognize = vi.fn().mockResolvedValue({
    data: {
      text: "FATURA\nNo: 123",
      blocks: [
        {
          paragraphs: [
            { lines: [{ words: [{ text: "FATURA", bbox: { x0: 1, y0: 1, x1: 9, y1: 5 }, confidence: 0.9 }] }] },
          ],
        },
      ],
    },
  });
  return {
    createWorker: vi.fn().mockResolvedValue({ recognize, terminate: vi.fn().mockResolvedValue(undefined) }),
  };
});

describe("OcrEngine", () => {
  it("recognizes a page into PageText with spans", async () => {
    const engine = new OcrEngine({ langPath: "/", corePath: "/", workerPath: "/", lang: "tur" });
    await engine.init();
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const out = await engine.recognizePage(canvas, 1);
    expect(out.source).toBe("ocr");
    expect(out.pageNumber).toBe(1);
    expect(out.text).toContain("FATURA");
    expect(out.spans[0].bbox).toEqual({ x0: 1, y0: 1, x1: 9, y1: 5 });
  });
  it("throws when not initialized", async () => {
    const engine = new OcrEngine({ langPath: "/", corePath: "/", workerPath: "/", lang: "tur" });
    await expect(engine.recognizePage({} as HTMLCanvasElement, 1)).rejects.toThrow("not initialized");
  });
});
```

- [ ] **Step 4: test + typecheck + build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/ocr scripts/copy-static.mjs public/manifest.json tests/unit/ocr.test.ts
git commit -m "feat: add local OCR engine with tesseract.js"
```

---