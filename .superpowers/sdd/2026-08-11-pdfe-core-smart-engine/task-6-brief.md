### Task 6: Viewer UI — toolbar, gezinme, zoom, ara (literal)

**Files:**
- Create: `src/viewer/toolbar.ts`
- Create: `src/viewer/findBar.ts`
- Modify: `src/viewer/viewer.ts`
- Modify: `src/viewer/viewer.css`
- Test: `tests/unit/toolbar.test.ts`

**Interfaces:**
- Consumes: `renderPage` (Task 5)
- Produces: `createToolbar({ onNavigate, onZoom, onFind }): HTMLElement`, `createFindBar({ onFind })` — literal arama (regex destekli), sonuçlara `find-result` class'ı ekler.

- [ ] **Step 1: src/viewer/toolbar.ts yaz**

```ts
export interface ToolbarCallbacks {
  onNavigate: (delta: number) => void;
  onZoom: (factor: number) => void;
  onFind: (query: string) => void;
  onToggleSmartPanel: () => void;
}

export function createToolbar(cb: ToolbarCallbacks): HTMLElement {
  const el = document.createElement("div");
  el.id = "toolbar";
  el.innerHTML = `
    <button data-act="prev" title="Önceki sayfa">‹</button>
    <span id="pageInfo">1 / 1</span>
    <button data-act="next" title="Sonraki sayfa">›</button>
    <button data-act="zoomOut" title="Uzaklaştır">−</button>
    <button data-act="zoomIn" title="Yakınlaştır">+</button>
    <input id="findInput" type="search" placeholder="Ara…" />
    <button data-act="findPrev" title="Önceki sonuç">↑</button>
    <button data-act="findNext" title="Sonraki sonuç">↓</button>
    <button data-act="smart" title="Akıllı Panel">🧠</button>
  `;
  el.querySelector<HTMLButtonElement>("[data-act=prev]")!.onclick = () => cb.onNavigate(-1);
  el.querySelector<HTMLButtonElement>("[data-act=next]")!.onclick = () => cb.onNavigate(1);
  el.querySelector<HTMLButtonElement>("[data-act=zoomOut]")!.onclick = () => cb.onZoom(0.85);
  el.querySelector<HTMLButtonElement>("[data-act=zoomIn]")!.onclick = () => cb.onZoom(1.2);
  el.querySelector<HTMLInputElement>("#findInput")!.addEventListener("input", (e) => cb.onFind((e.target as HTMLInputElement).value));
  el.querySelector<HTMLButtonElement>("[data-act=findPrev]")!.onclick = () => cb.onFind((el.querySelector<HTMLInputElement>("#findInput")!.value));
  el.querySelector<HTMLButtonElement>("[data-act=findNext]")!.onclick = () => cb.onFind((el.querySelector<HTMLInputElement>("#findInput")!.value));
  el.querySelector<HTMLButtonElement>("[data-act=smart]")!.onclick = () => cb.onToggleSmartPanel();
  return el;
}

export function updatePageInfo(el: HTMLElement, current: number, total: number): void {
  el.textContent = `${current} / ${total}`;
}
```

- [ ] **Step 2: src/viewer/findBar.ts yaz** (literal + regex arama, text layer span'larını vurgular)

```ts
export interface FindResult {
  pageNumber: number;
  spanIndex: number;
  text: string;
}

interface FindableSpan {
  text: string;
  pageNumber?: number;
}

export function findInSpans(
  spans: FindableSpan[],
  query: string,
  regex = false
): FindResult[] {
  if (!query) return [];
  const results: FindResult[] = [];
  try {
    const re = regex ? new RegExp(query, "gi") : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    spans.forEach((span, idx) => {
      re.lastIndex = 0;
      if (re.test(span.text)) results.push({ pageNumber: span.pageNumber ?? -1, spanIndex: idx, text: span.text });
    });
  } catch {
    return [];
  }
  return results;
}
```
> `pageNumber` çağıran tarafın flatMap ile span'a eklediği alandan gelir (`{ ...s, pageNumber: i + 1 }`); eklenmemişse `-1` kalır (tek başına testte anlamlı). Bu fonksiyon saf ve test edilebilir.

- [ ] **Step 3: viewer.ts'yi toolbar + gezinme + zoom + arama ile genişlet**

```ts
import "./viewer.css";
import { loadDocument } from "./pdfLoader";
import { renderPage, type RenderedPage } from "./pageRenderer";
import { createToolbar, updatePageInfo } from "./toolbar";
import { findInSpans, type FindResult } from "./findBar";

const renderedPages: RenderedPage[] = [];
let currentPage = 1;
let scale = 1.25;
let pdf: import("pdfjs-dist").PDFDocumentProxy;

async function renderAll(): Promise<void> {
  const pages = document.getElementById("pages")!;
  pages.innerHTML = "";
  renderedPages.length = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const container = document.createElement("div");
    container.className = "page-container";
    pages.appendChild(container);
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);
    renderedPages.push(await renderPage(page, canvas, container, scale));
    page.cleanup();
  }
  updatePageInfo(document.getElementById("pageInfo")!, currentPage, pdf.numPages);
}

function scrollToPage(n: number): void {
  const pages = document.getElementById("pages")!;
  const target = pages.children[n - 1] as HTMLElement | undefined;
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function init(): Promise<void> {
  const file = getFileParam();
  const app = document.getElementById("app")!;
  app.appendChild(
    createToolbar({
      onNavigate: (delta) => { const n = Math.min(Math.max(currentPage + delta, 1), pdf.numPages); currentPage = n; scrollToPage(n); },
      onZoom: async (f) => { scale = Math.min(Math.max(scale * f, 0.5), 4); await renderAll(); scrollToPage(currentPage); },
      onFind: (q) => { const results = findInSpans(renderedPages.flatMap((r, i) => r.textSpans.map((s) => ({ ...s, pageNumber: i + 1 }))), q); },
      onToggleSmartPanel: () => { document.getElementById("smartPanel")?.classList.toggle("open"); },
    })
  );
  const pages = document.createElement("div");
  pages.id = "pages";
  app.appendChild(pages);

  pdf = await loadDocument(file);
  document.getElementById("title")!.textContent = file.split("/").pop() || file;
  await renderAll();
}

function getFileParam(): string {
  const url = new URL(location.href);
  const file = url.searchParams.get("file");
  return file ? decodeURIComponent(file) : "";
}

void init();
```
> Not: `FindResult.pageNumber` — `renderedPages.flatMap` ile sayfa numarası doldurulur; vurgulama görsel katmanı Task 10'da eklenir.

- [ ] **Step 4: tests/unit/findBar.test.ts yaz**

```ts
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
```

- [ ] **Step 5: test + build + typecheck**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS, hatasız.

- [ ] **Step 6: Commit**

```bash
git add src/viewer tests/unit/findBar.test.ts
git commit -m "feat: add viewer toolbar, navigation, zoom and literal search"
```

---