import { afterEach, describe, expect, it, vi } from "vitest";
import { bindSmartPanel, createSmartPanel } from "../../src/viewer/smartPanel";
import { highlightSpans } from "../../src/viewer/highlight";
import type { EnginePipeline } from "../../src/engine/pipeline";
import type { SearchResult } from "../../src/shared/types";

function buildContainers(): HTMLElement[] {
  return [["a", "b"], ["c", "örnek"]].map((spans) => {
    const page = document.createElement("div");
    const layer = document.createElement("div");
    layer.className = "textLayer";
    page.appendChild(layer);
    for (const t of spans) {
      const span = document.createElement("span");
      span.textContent = t;
      layer.appendChild(span);
    }
    return page;
  });
}

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function makeResult(pageNumber: number): SearchResult {
  return { pageNumber, spanIndex: 1, span: { text: "örnek" }, score: 0.8, kind: "semantic" };
}

async function runSearch(panel: HTMLElement): Promise<void> {
  const input = panel.querySelector<HTMLInputElement>("#semanticInput")!;
  input.value = "örnek";
  input.dispatchEvent(new Event("input"));
  await vi.advanceTimersByTimeAsync(300);
}

describe("smartPanel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });
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
    expect(panel.querySelector<HTMLElement>("#ocrProgressWrap")!.hidden).toBe(true);
  });
  it("passes the full search result to onHighlight on result click", async () => {
    vi.useFakeTimers();
    const panel = createSmartPanel();
    const result: SearchResult = makeResult(2);
    const pipeline = { search: vi.fn().mockResolvedValue([result]) } as unknown as EnginePipeline;
    const onHighlight = vi.fn();
    bindSmartPanel(panel, { pipeline, onHighlight });
    await runSearch(panel);
    panel.querySelector<HTMLElement>("#searchResults li")!.click();
    expect(onHighlight).toHaveBeenCalledWith(result);
  });
  it("highlights the result span and navigates on result click", async () => {
    vi.useFakeTimers();
    const panel = createSmartPanel();
    const result: SearchResult = makeResult(2);
    const pipeline = { search: vi.fn().mockResolvedValue([result]) } as unknown as EnginePipeline;
    const containers = buildContainers();
    const scrollToPage = vi.fn();
    bindSmartPanel(panel, {
      pipeline,
      onHighlight: (r) => {
        highlightSpans(containers, [{ pageNumber: r.pageNumber, spanIndex: r.spanIndex }]);
        scrollToPage(r.pageNumber);
      },
    });
    await runSearch(panel);
    panel.querySelector<HTMLElement>("#searchResults li")!.click();
    expect(scrollToPage).toHaveBeenCalledWith(2);
    expect(containers[1].querySelectorAll(".textLayer span")[1].classList.contains("pdfe-highlight")).toBe(true);
    expect(containers[0].querySelectorAll(".textLayer span")[0].classList.contains("pdfe-highlight")).toBe(false);
  });
  it("renders 'Sonuç yok' when search returns no results", async () => {
    vi.useFakeTimers();
    const panel = createSmartPanel();
    const pipeline = { search: vi.fn().mockResolvedValue([]) } as unknown as EnginePipeline;
    bindSmartPanel(panel, { pipeline, onHighlight: () => {} });
    await runSearch(panel);
    expect(panel.querySelector("#searchResults")!.textContent).toContain("Sonuç yok");
  });
  it("renders an error message when search fails", async () => {
    vi.useFakeTimers();
    const panel = createSmartPanel();
    const pipeline = { search: vi.fn().mockRejectedValue(new Error("model yüklenemedi")) } as unknown as EnginePipeline;
    bindSmartPanel(panel, { pipeline, onHighlight: () => {} });
    await runSearch(panel);
    expect(panel.querySelector("#searchResults")!.textContent).toContain("model yüklenemedi");
  });
  it("ignores stale results that resolve after a newer query", async () => {
    vi.useFakeTimers();
    const panel = createSmartPanel();
    const first = deferred<SearchResult[]>();
    const second = deferred<SearchResult[]>();
    const pipeline = { search: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise) } as unknown as EnginePipeline;
    bindSmartPanel(panel, { pipeline, onHighlight: () => {} });
    const input = panel.querySelector<HTMLInputElement>("#semanticInput")!;

    input.value = "ilk";
    input.dispatchEvent(new Event("input"));
    await vi.advanceTimersByTimeAsync(300);

    input.value = "son";
    input.dispatchEvent(new Event("input"));
    await vi.advanceTimersByTimeAsync(300);

    second.resolve([makeResult(2)]);
    await Promise.resolve();
    expect(panel.querySelector("#searchResults")!.textContent).toContain("2. sayfa");

    first.resolve([makeResult(1)]);
    await Promise.resolve();
    expect(panel.querySelector("#searchResults")!.textContent).toContain("2. sayfa");
    expect(panel.querySelector("#searchResults")!.textContent).not.toContain("1. sayfa");
  });
  it("triggers the highlight action when a result receives Enter", async () => {
    vi.useFakeTimers();
    const panel = createSmartPanel();
    const result: SearchResult = makeResult(2);
    const pipeline = { search: vi.fn().mockResolvedValue([result]) } as unknown as EnginePipeline;
    const onHighlight = vi.fn();
    bindSmartPanel(panel, { pipeline, onHighlight });
    await runSearch(panel);
    panel.querySelector<HTMLElement>("#searchResults li")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onHighlight).toHaveBeenCalledWith(result);
  });
  it("toggles corpus and search index readiness indicators", () => {
    const panel = createSmartPanel();
    const pipeline = { search: vi.fn().mockResolvedValue([]) } as unknown as EnginePipeline;
    const api = bindSmartPanel(panel, { pipeline, onHighlight: () => {} });
    api.setState({ ocr: "running", ocrProgress: 0.5, corpusReady: false, searchReady: false });
    expect(panel.querySelector("#corpusStatus")!.textContent).toContain("Korpus hazırlanıyor");
    expect(panel.querySelector("#searchIndexStatus")!.textContent).toContain("Arama endeksi hazırlanıyor");
    api.setState({ ocr: "done", ocrProgress: 1, corpusReady: true, searchReady: true });
    expect(panel.querySelector("#corpusStatus")!.textContent).toContain("Korpus hazır");
    expect(panel.querySelector("#searchIndexStatus")!.textContent).toContain("Arama endeksi hazır");
  });
});