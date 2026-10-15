### Task 10: Viewer — highlight katmanı + arama vurgulama + Akıllı Panel taslağı

**Files:**
- Create: `src/viewer/highlight.ts`
- Create: `src/viewer/smartPanel.ts`
- Modify: `src/viewer/viewer.ts`
- Modify: `src/viewer/viewer.css`
- Test: `tests/unit/highlight.test.ts`

**Interfaces:**
- Consumes: `findInSpans` (Task 6), `SearchResult` (Task 2)
- Produces: `highlightSpans(container, matches: { spanIndex, pageNumber }[])`, `createSmartPanel(): HTMLElement` (OCR durumu, anlamsal arama, özet, çıkarma sekmeleri — Task 11-14'te doldurulur).

- [ ] **Step 1: src/viewer/highlight.ts yaz**

```ts
import type { SearchResult } from "../shared/types";

export interface TextSpanRef {
  pageNumber: number;
  spanIndex: number;
}

export function highlightSpans(containers: HTMLElement[], refs: TextSpanRef[]): number {
  for (const el of containers) el.classList.remove("pdfe-highlight");
  const pageEls = containers.map((el) => el.querySelectorAll(".textLayer span"));
  let count = 0;
  for (const ref of refs) {
    const spans = pageEls[ref.pageNumber - 1];
    const span = spans?.[ref.spanIndex] as HTMLElement | undefined;
    if (span) {
      span.classList.add("pdfe-highlight");
      count++;
    }
  }
  return count;
}

export function searchResultsToRefs(results: SearchResult[]): TextSpanRef[] {
  return results.map((r) => ({ pageNumber: r.pageNumber, spanIndex: r.spanIndex }));
}
```

- [ ] **Step 2: src/viewer/smartPanel.ts yaz** (iskelet — sekme yapısı, içerik Task 12-14)

```ts
export function createSmartPanel(): HTMLElement {
  const panel = document.createElement("aside");
  panel.id = "smartPanel";
  panel.innerHTML = `
    <nav>
      <button data-tab="ocr" class="active">OCR</button>
      <button data-tab="search">Akıllı Arama</button>
      <button data-tab="summary">Özet</button>
      <button data-tab="extract">Veri</button>
    </nav>
    <section id="tab-ocr"></section>
    <section id="tab-search" hidden></section>
    <section id="tab-summary" hidden></section>
    <section id="tab-extract" hidden></section>
  `;
  panel.querySelectorAll<HTMLButtonElement>("nav button").forEach((btn) => {
    btn.onclick = () => {
      panel.querySelectorAll("nav button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      panel.querySelectorAll("section").forEach((s) => (s.hidden = true));
      panel.querySelector(`#tab-${btn.dataset.tab}`)!.hidden = false;
    };
  });
  return panel;
}
```

- [ ] **Step 3: viewer.css'ye highlight + panel stilleri ekle**

```css
.textLayer span.pdfe-highlight { background: rgba(255, 200, 0, .5); }
#smartPanel { position: fixed; top: 48px; right: 0; bottom: 0; width: 340px; background: #1f1f1f; border-left: 1px solid #444; transform: translateX(100%); transition: transform .2s; display: flex; flex-direction: column; z-index: 10; }
#smartPanel.open { transform: translateX(0); }
#smartPanel nav { display: flex; }
#smartPanel nav button { flex: 1; padding: 8px; background: none; color: #ccc; border: none; cursor: pointer; }
#smartPanel nav button.active { background: #333; color: #fff; }
#smartPanel section { padding: 12px; overflow: auto; flex: 1; }
```

- [ ] **Step 4: viewer.ts'ye highlight + smart panel bağla**

Modify `src/viewer/viewer.ts`: `onFind` callback'ini arama yapıp `highlightSpans` ile vurgulayacak şekilde, `onToggleSmartPanel` ile panel'i `open` toggle'layacak şekilde düzenle. Her sayfa render edilirken `renderedPages[i]` yanında `.textLayer` referansını sakla (ör. `renderedLayers: HTMLElement[]`).

```ts
// viewer.ts içine:
import { highlightSpans } from "./highlight";
import { createSmartPanel } from "./smartPanel";

const renderedLayers: HTMLElement[] = [];

// renderAll içinde renderPage sonrası:
renderedLayers.push(container.querySelector(".textLayer")!);

// onFind içinde:
const results = findInSpans(renderedPages.flatMap((r, i) => r.textSpans.map((s) => ({ ...s, pageNumber: i + 1 }))), q);
const refs = results.map((r) => ({ pageNumber: r.pageNumber, spanIndex: r.spanIndex }));
highlightSpans(renderedLayers, refs);

// init içinde app.appendChild(createSmartPanel())
```

- [ ] **Step 5: tests/unit/highlight.test.ts yaz** (jsdom)

```ts
import { describe, expect, it } from "vitest";
import { searchResultsToRefs } from "../../src/viewer/highlight";

describe("highlight", () => {
  it("converts search results to refs", () => {
    const refs = searchResultsToRefs([
      { pageNumber: 2, spanIndex: 3, span: { text: "x" }, score: 0.5, kind: "semantic" },
    ]);
    expect(refs).toEqual([{ pageNumber: 2, spanIndex: 3 }]);
  });
});
```
> `highlightSpans` DOM'a dokunduğundan jsdom'da container'lar olmadan davranışı test etmek zahmetli; bu görevde saf dönüşüm testi yeterli, DOM davranışı e2e'de (Task 17) doğrulanır.

- [ ] **Step 6: test + build + typecheck**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/viewer tests/unit/highlight.test.ts
git commit -m "feat: add search highlighting and smart panel scaffold"
```

---