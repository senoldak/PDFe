import type { DocumentCorpus, EngineState, SearchResult } from "../shared/types";
import type { EnginePipeline } from "../engine/pipeline";
import type { Summarizer } from "../engine/summarize/summarizer";

export interface SmartPanelCallbacks {
  pipeline: EnginePipeline;
  onHighlight: (result: SearchResult) => void;
  summarizer?: Summarizer;
  getCorpus?: () => DocumentCorpus | null;
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
      panel.querySelector<HTMLElement>(`#tab-${btn.dataset.tab}`)!.hidden = false;
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
  const summarizeBtn = panel.querySelector<HTMLButtonElement>("#summarizeBtn")!;
  const summaryOutput = panel.querySelector<HTMLElement>("#summaryOutput")!;

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

  summarizeBtn.addEventListener("click", async () => {
    const corpus = cb.getCorpus?.() ?? null;
    if (!cb.summarizer || !corpus) return;
    summaryOutput.textContent = await cb.summarizer.summarize(corpus.fullText);
  });

  function renderResults(results: SearchResult[]): void {
    resultsEl.innerHTML = "";
    for (const r of results) {
      const li = document.createElement("li");
      li.textContent = `${r.pageNumber}. sayfa — ${r.span.text.slice(0, 60)}`;
      li.onclick = () => cb.onHighlight(r);
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
