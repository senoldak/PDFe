### Task 12: Akıllı Panel — OCR durumu + anlamsal arama UI

**Files:**
- Modify: `src/viewer/smartPanel.ts`
- Modify: `src/viewer/viewer.ts`
- Modify: `src/viewer/viewer.css`
- Test: `tests/unit/smartPanel.test.ts`

**Interfaces:**
- Consumes: `EnginePipeline` (Task 11), `SearchResult` (Task 2)
- Produces: `bindSmartPanel(panel, { pipeline, onHighlight }): { setState(s): void; }` — OCR ilerleme çubuğu, anlamsal arama kutusu, sonuç listesi; her sonuç tıklanınca `onHighlight(pageNumber)` çağrılır.

- [ ] **Step 1: smartPanel.ts'yi işlevsel hale getir**

```ts
import type { EngineState, SearchResult } from "../shared/types";
import type { EnginePipeline } from "../engine/pipeline";

export interface SmartPanelCallbacks {
  pipeline: EnginePipeline;
  onHighlight: (pageNumber: number) => void;
}

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
    <section id="tab-ocr">
      <div id="ocrStatus">Hazır</div>
      <div id="ocrProgressWrap" hidden><progress id="ocrProgress" max="1" value="0"></progress></div>
    </section>
    <section id="tab-search" hidden>
      <input id="semanticInput" type="search" placeholder="Anlamlı ara…" />
      <ul id="searchResults"></ul>
    </section>
    <section id="tab-summary" hidden>
      <button id="summarizeBtn">Özetle</button>
      <div id="summaryOutput"></div>
    </section>
    <section id="tab-extract" hidden>
      <button id="extractBtn">Verileri Çıkar</button>
      <div id="extractOutput"></div>
    </section>
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

export function bindSmartPanel(panel: HTMLElement, cb: SmartPanelCallbacks): { setState(s: EngineState): void } {
  const status = panel.querySelector<HTMLElement>("#ocrStatus")!;
  const progressWrap = panel.querySelector<HTMLElement>("#ocrProgressWrap")!;
  const progress = panel.querySelector<HTMLProgressElement>("#ocrProgress")!;
  const input = panel.querySelector<HTMLInputElement>("#semanticInput")!;
  const resultsEl = panel.querySelector<HTMLElement>("#searchResults")!;

  let timer: ReturnType<typeof setTimeout> | undefined;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) return;
    timer = setTimeout(async () => {
      const results = await cb.pipeline.search(q);
      renderResults(results);
    }, 300);
  });

  function renderResults(results: SearchResult[]): void {
    resultsEl.innerHTML = "";
    for (const r of results) {
      const li = document.createElement("li");
      li.textContent = `${r.pageNumber}. sayfa — ${r.span.text.slice(0, 60)}`;
      li.onclick = () => cb.onHighlight(r.pageNumber);
      resultsEl.appendChild(li);
    }
  }

  return {
    setState(s: EngineState): void {
      status.textContent =
        s.ocr === "loading" ? "OCR yükleniyor…" :
        s.ocr === "running" ? "OCR çalışıyor…" :
        s.ocr === "done" ? "OCR tamamlandı" :
        s.ocr === "failed" ? "OCR başarısız" : "Hazır";
      progressWrap.hidden = s.ocr !== "running";
      progress.value = s.ocrProgress;
    },
  };
}
```

- [ ] **Step 2: viewer.ts'ye pipeline + panel bağla**

Modify `src/viewer/viewer.ts`:
- `EnginePipeline` oluştur (`ocr`, `semantic` örnekleri `chrome.runtime.getURL` yollarıyla)
- `pipeline.setState` → `panelApi.setState`
- `run(pdf.pages..., { scale })` — `pdf.getPage` döngüsüyle tüm sayfaları al
- `onHighlight(pageNumber)` → `scrollToPage`
- "Özetle" ve "Verileri Çıkar" butonları Task 13/14'te dolar; bu görevde yalnızca OCR + arama canlıdır.

- [ ] **Step 3: smartPanel.test.ts yaz** (DOM'daki setState davranışı)

```ts
import { describe, expect, it, vi } from "vitest";
import { bindSmartPanel, createSmartPanel } from "../../src/viewer/smartPanel";
import type { EnginePipeline } from "../../src/engine/pipeline";

describe("smartPanel", () => {
  it("renders OCR status text", () => {
    const panel = createSmartPanel();
    const pipeline = { search: vi.fn().mockResolvedValue([]) } as unknown as EnginePipeline;
    const api = bindSmartPanel(panel, { pipeline, onHighlight: () => {} });
    api.setState({ ocr: "running", ocrProgress: 0.5, corpusReady: false, searchReady: false });
    expect(panel.querySelector("#ocrStatus")!.textContent).toContain("OCR çalışıyor");
  });
  it("shows progress bar only while running", () => {
    const panel = createSmartPanel();
    const pipeline = { search: vi.fn().mockResolvedValue([]) } as unknown as EnginePipeline;
    const api = bindSmartPanel(panel, { pipeline, onHighlight: () => {} });
    api.setState({ ocr: "done", ocrProgress: 1, corpusReady: true, searchReady: true });
    expect(panel.querySelector("#ocrProgressWrap")!.hidden).toBe(true);
  });
});
```

- [ ] **Step 4: test + typecheck + build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/viewer tests/unit/smartPanel.test.ts
git commit -m "feat: bind smart panel to pipeline with OCR status and semantic search"
```

---