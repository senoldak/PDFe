### Task 5: Viewer çekirdeği — pdfjs-dist yükleme + sayfa render + text layer

**Files:**
- Create: `src/viewer/viewer.ts` (mevcut iskeleti doldur)
- Create: `src/viewer/pdfLoader.ts`
- Create: `src/viewer/pageRenderer.ts`
- Create: `src/viewer/viewer.css`
- Test: `tests/unit/pageRenderer.test.ts`

**Interfaces:**
- Consumes: pdfjs-dist `getDocument`, `GlobalWorkerOptions`, `TextLayer`; `viewer:get-url` mesajı (Task 3)
- Produces: `loadDocument(url: string): Promise<PDFDocumentProxy>`, `renderPage(page, canvas, viewport, container): Promise<{ textLayer: TextLayer, spans: TextSpan[] }>`, `getPageText(page, viewport): Promise<{ items: ...; }>` — sonraki görevlere korpus besler.

- [ ] **Step 1: src/viewer/pdfLoader.ts yaz** (Vite uyumlu worker kurulumu)

```ts
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.mjs");

export async function loadDocument(url: string): Promise<PDFDocumentProxy> {
  const task = getDocument({ url });
  return task.promise;
}
```

- [ ] **Step 2: src/viewer/pageRenderer.ts yaz**

```ts
import { TextLayer, type PageViewport } from "pdfjs-dist";
import type { PDFPageProxy } from "pdfjs-dist";
import type { TextSpan } from "../shared/types";

export interface RenderedPage {
  textSpans: TextSpan[];
  canvas: HTMLCanvasElement;
}

export async function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  scale: number
): Promise<RenderedPage> {
  const viewport = page.getViewport({ scale });
  const outputScale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport, transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null }).promise;

  const textDiv = document.createElement("div");
  textDiv.className = "textLayer";
  container.appendChild(textDiv);

  const textContent = await page.getTextContent();
  const textLayer = new TextLayer({
    textContentSource: textContent,
    container: textDiv,
    viewport,
  });
  await textLayer.render();

  const spans: TextSpan[] = [];
  for (const item of textContent.items) {
    const s = item as any;
    if (typeof s.str === "string" && s.str.trim()) {
      spans.push({ text: s.str, bbox: s.transform ? undefined : undefined, confidence: undefined });
    }
  }
  return { textSpans: spans, canvas };
}
```
> Not: `getTextContent()` dönen `TextContent` aynı zamanda `textContentSource` olarak `TextLayer`'a verilir (ReadableStream değilse içeride sarılır). `bbox` üretimi için `page.getTextContent()` içindeki `item.transform` + `item.width/height` kullanılabilir; bu görevde `spans[].text` yeterlidir, bbox Takım 11'de doldurulur.

- [ ] **Step 3: src/viewer/viewer.css yaz** (temel layout + text layer görünümü)

```css
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; font-family: system-ui, sans-serif; background: #2b2b2b; color: #eee; }
#app { display: flex; flex-direction: column; height: 100vh; }
#toolbar { display: flex; gap: 8px; align-items: center; padding: 8px; background: #1f1f1f; }
#pages { flex: 1; overflow: auto; padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.page-container { position: relative; box-shadow: 0 2px 12px rgba(0,0,0,.5); }
.textLayer { position: absolute; inset: 0; overflow: hidden; opacity: .25; line-height: 1; text-align: initial; transform-origin: 0 0; }
.textLayer span { position: absolute; white-space: pre; cursor: text; transform-origin: 0% 0%; }
.textLayer ::selection { background: rgba(0, 122, 255, .6); }
```

- [ ] **Step 4: src/viewer/viewer.ts yaz** (başlangıç: URL'den file çıkar, dokümanı yükle, ilk sayfayı render et)

```ts
import "./viewer.css";
import { loadDocument } from "./pdfLoader";
import { renderPage } from "./pageRenderer";

function getFileParam(): string {
  const url = new URL(location.href);
  const file = url.searchParams.get("file");
  if (file) return decodeURIComponent(file);
  return "";
}

async function init(): Promise<void> {
  const file = getFileParam();
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <div id="toolbar"><span id="title"></span></div>
    <div id="pages"></div>
  `;
  document.getElementById("title")!.textContent = file.split("/").pop() || file;

  const pages = document.getElementById("pages")!;
  const pdf = await loadDocument(file);
  const pageCount = pdf.numPages;

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const container = document.createElement("div");
    container.className = "page-container";
    pages.appendChild(container);
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);
    await renderPage(page, canvas, container, 1.25);
    page.cleanup();
  }
}

void init();
```

- [ ] **Step 5: tests/unit/pageRenderer.test.ts yaz** — `page.render` mock'lu basit render sonucu kontrolü

```ts
import { describe, expect, it, vi } from "vitest";
import type { PDFPageProxy } from "pdfjs-dist";

function mockPage(): PDFPageProxy {
  const viewport = { width: 100, height: 200, scale: 1, rotation: 0, rawDims: { pageWidth: 100, pageHeight: 200, pageX: 0, pageY: 0 } };
  return {
    getViewport: (opts: any) => ({ ...viewport, scale: opts.scale }),
    render: vi.fn().mockResolvedValue({ promise: Promise.resolve() }),
    getTextContent: vi.fn().mockResolvedValue({ items: [{ str: "merhaba", width: 10, height: 10, transform: [1, 0, 0, 1, 0, 0] }] }),
    cleanup: vi.fn(),
  } as unknown as PDFPageProxy;
}

describe("renderPage", () => {
  it("returns text spans from text content", async () => {
    const { renderPage } = await import("../../src/viewer/pageRenderer");
    const page = mockPage();
    const canvas = document.createElement("canvas");
    const container = document.createElement("div");
    const result = await renderPage(page, canvas, container, 1);
    expect(result.textSpans.length).toBe(1);
    expect(result.textSpans[0].text).toBe("merhaba");
  });
});
```
> Not: Bu test DOM gerektirir; `vitest` config'ine `environment: "jsdom"` eklemek gerekir. `npm i -D jsdom` ve `vite.config.ts` içinde `test.environment`'ı `"jsdom"` yap; unit testlerin çoğu saf mantık olduğundan jsdom'a geçmek sorun değildir. `environment`'ı jsdom yap ve `document.createElement` çağrıları için jsdom DOM'u yeterli. `TextLayer` gerçek render'ı jsdom'da worker gerektirmez ama `page.getTextContent()` mock'landığı için sorun olmaz. Ancak `new TextLayer({...}).render()` gerçek bir ReadableStream bekler; mock'lu `textContent` objesi geçildiğinde içeride stream'e sarılır. Bu testte `render()` sonrası span'lar bizim döngümüzden gelir — TextLayer render'ı jsdom'da DOM'a yazar; çakışma olmaması için `container.appendChild(textDiv)` gerçekleşir ve sorunsuz çalışır.

- [ ] **Step 6: jsdom kur + testi çalıştır**

Run: `npm i -D jsdom`
Modify `vite.config.ts`: `test: { environment: "jsdom", include: ["tests/unit/**/*.test.ts"] }`
Run: `npm run test`
Expected: PASS.

- [ ] **Step 7: build + typecheck**

Run: `npm run typecheck && npm run build`
Expected: hatasız.

- [ ] **Step 8: Commit**

```bash
git add src/viewer tests/unit/pageRenderer.test.ts vite.config.ts package.json
git commit -m "feat: render PDF pages with pdfjs-dist and text layer"
```

---