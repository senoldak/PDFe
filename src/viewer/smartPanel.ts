import type { DocumentCorpus, EngineState, SearchResult } from "../shared/types";
import type { EnginePipeline } from "../engine/pipeline";
import type { Summarizer } from "../engine/summarize/summarizer";
import { extractFields } from "../engine/extract/extract";
import { INVOICE_SCHEMA } from "../engine/extract/schemas";

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
      <div id="corpusStatus">Korpus hazırlanıyor…</div>
      <div id="ocrProgressWrap" hidden><progress id="ocrProgress" max="1" value="0"></progress></div>
    </section>
    <section id="tab-search" hidden>
      <input id="semanticInput" type="search" placeholder="Anlamlı ara…" />
      <div id="searchIndexStatus">Arama endeksi hazırlanıyor…</div>
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
  const corpusStatus = panel.querySelector<HTMLElement>("#corpusStatus")!;
  const searchIndexStatus = panel.querySelector<HTMLElement>("#searchIndexStatus")!;
  const progressWrap = panel.querySelector<HTMLElement>("#ocrProgressWrap")!;
  const progress = panel.querySelector<HTMLProgressElement>("#ocrProgress")!;
  const input = panel.querySelector<HTMLInputElement>("#semanticInput")!;
  const resultsEl = panel.querySelector<HTMLElement>("#searchResults")!;
  const summarizeBtn = panel.querySelector<HTMLButtonElement>("#summarizeBtn")!;
  const summaryOutput = panel.querySelector<HTMLElement>("#summaryOutput")!;
  const extractBtn = panel.querySelector<HTMLButtonElement>("#extractBtn")!;
  const extractOutput = panel.querySelector<HTMLElement>("#extractOutput")!;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let searchSeq = 0;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    searchSeq++;
    const q = input.value.trim();
    if (q.length < 2) {
      resultsEl.innerHTML = "";
      return;
    }
    const seq = searchSeq;
    timer = setTimeout(async () => {
      try {
        const results = await cb.pipeline.search(q);
        if (seq === searchSeq) renderResults(results);
      } catch (e) {
        if (seq !== searchSeq) return;
        resultsEl.innerHTML = "";
        const li = document.createElement("li");
        li.className = "error";
        li.textContent = "Arama hatası: " + (e instanceof Error ? e.message : String(e));
        resultsEl.appendChild(li);
      }
    }, 300);
  });

  let summarizerReady = false;
  summarizeBtn.addEventListener("click", async () => {
    const summarizer = cb.summarizer;
    const corpus = cb.getCorpus?.() ?? null;
    if (!summarizer) {
      summaryOutput.textContent = "Özetleyici hazır değil.";
      return;
    }
    if (!corpus || !corpus.fullText.trim()) {
      summaryOutput.textContent = "Özetlenecek metin yok.";
      return;
    }
    summaryOutput.textContent = "Özetleniyor…";
    try {
      if (!summarizerReady) {
        await summarizer.init();
        summarizerReady = true;
      }
      summaryOutput.textContent = await summarizer.summarize(corpus.fullText);
    } catch (e) {
      summaryOutput.textContent = "Özetleme hatası: " + (e instanceof Error ? e.message : String(e));
    }
  });

  extractBtn.addEventListener("click", () => {
    const corpus = cb.getCorpus?.() ?? null;
    if (!corpus) return;
    const result = extractFields(corpus, INVOICE_SCHEMA);
    extractOutput.innerHTML = "";
    const table = document.createElement("table");
    for (const [key, field] of Object.entries(INVOICE_SCHEMA.fields)) {
      const row = document.createElement("tr");
      const labelCell = document.createElement("td");
      labelCell.textContent = field.label;
      const valueCell = document.createElement("td");
      const value = result[key];
      valueCell.textContent = value == null ? "—" : String(value);
      row.append(labelCell, valueCell);
      table.appendChild(row);
    }
    extractOutput.appendChild(table);
  });

  function renderResults(results: SearchResult[]): void {
    resultsEl.innerHTML = "";
    if (!results.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "Sonuç yok";
      resultsEl.appendChild(li);
      return;
    }
    for (const r of results) {
      const li = document.createElement("li");
      li.tabIndex = 0;
      li.setAttribute("role", "button");
      li.textContent = `${r.pageNumber}. sayfa — ${r.span.text.slice(0, 60)}`;
      const select = (): void => cb.onHighlight(r);
      li.addEventListener("click", select);
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          select();
        }
      });
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
      corpusStatus.textContent = s.corpusReady ? "Korpus hazır" : "Korpus hazırlanıyor…";
      searchIndexStatus.textContent = s.searchReady ? "Arama endeksi hazır" : "Arama endeksi hazırlanıyor…";
      progressWrap.hidden = s.ocr !== "running";
      progress.value = s.ocrProgress;
    },
  };
}