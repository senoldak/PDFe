import "./viewer.css";
import { loadDocument } from "./pdfLoader";
import { renderPage, type RenderedPage } from "./pageRenderer";
import { createToolbar, updatePageInfo } from "./toolbar";
import { findInSpans, type FindResult } from "./findBar";
import { highlightSpans } from "./highlight";
import { createSmartPanel, bindSmartPanel } from "./smartPanel";
import { configureRuntime } from "../engine/runtime";
import { EnginePipeline } from "../engine/pipeline";
import { OcrEngine } from "../engine/ocr/ocr";
import { SemanticSearch } from "../engine/search/semantic";
import type { PDFPageProxy } from "pdfjs-dist";

const renderedPages: RenderedPage[] = [];
const renderedLayers: HTMLElement[] = [];
let currentPage = 1;
let scale = 1.25;
let pdf: import("pdfjs-dist").PDFDocumentProxy;

async function renderAll(): Promise<void> {
  const pages = document.getElementById("pages")!;
  pages.innerHTML = "";
  renderedPages.length = 0;
  renderedLayers.length = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const container = document.createElement("div");
    container.className = "page-container";
    pages.appendChild(container);
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);
    renderedPages.push(await renderPage(page, canvas, container, scale));
    renderedLayers.push(container.querySelector(".textLayer")!);
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
  configureRuntime();
  const file = getFileParam();
  const app = document.getElementById("app")!;
  app.appendChild(
    createToolbar({
      onNavigate: (delta) => { const n = Math.min(Math.max(currentPage + delta, 1), pdf.numPages); currentPage = n; scrollToPage(n); },
      onZoom: async (f) => { scale = Math.min(Math.max(scale * f, 0.5), 4); await renderAll(); scrollToPage(currentPage); },
      onFind: (q) => {
        const results = findInSpans(renderedPages.flatMap((r, i) => r.textSpans.map((s) => ({ ...s, pageNumber: i + 1 }))), q);
        const refs = results.map((r) => ({ pageNumber: r.pageNumber, spanIndex: r.spanIndex }));
        highlightSpans(renderedLayers, refs);
      },
      onToggleSmartPanel: () => { document.getElementById("smartPanel")?.classList.toggle("open"); },
    })
  );
  const pages = document.createElement("div");
  pages.id = "pages";
  app.appendChild(pages);

  const panel = createSmartPanel();
  app.appendChild(panel);

  const pipeline = new EnginePipeline({
    ocr: new OcrEngine({
      langPath: chrome.runtime.getURL("models/tessdata/"),
      corePath: chrome.runtime.getURL("tesseract-core/"),
      workerPath: chrome.runtime.getURL("tesseract/tesseract.min.js"),
      lang: "tur",
      gzip: false,
    }),
    semantic: new SemanticSearch(),
    ocrLangPath: chrome.runtime.getURL("models/tessdata/"),
    ocrCorePath: chrome.runtime.getURL("tesseract-core/"),
    ocrWorkerPath: chrome.runtime.getURL("tesseract/tesseract.min.js"),
  });
  const panelApi = bindSmartPanel(panel, {
    pipeline,
    onHighlight: (r) => {
      highlightSpans(renderedLayers, [{ pageNumber: r.pageNumber, spanIndex: r.spanIndex }]);
      scrollToPage(r.pageNumber);
    },
  });
  pipeline.setState((s) => panelApi.setState(s));

  pdf = await loadDocument(file);
  const title = document.getElementById("title");
  if (title) title.textContent = file.split("/").pop() || file;
  await renderAll();

  const pageProxies: PDFPageProxy[] = [];
  for (let i = 1; i <= pdf.numPages; i++) pageProxies.push(await pdf.getPage(i));
  await pipeline.run(pageProxies, { scale });
}

function getFileParam(): string {
  const url = new URL(location.href);
  const file = url.searchParams.get("file");
  return file ? decodeURIComponent(file) : "";
}

void init();