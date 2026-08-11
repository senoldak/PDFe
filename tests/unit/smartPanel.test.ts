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
    const result: SearchResult = { pageNumber: 2, spanIndex: 1, span: { text: "örnek" }, score: 0.8, kind: "semantic" };
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
    const result: SearchResult = { pageNumber: 2, spanIndex: 1, span: { text: "örnek" }, score: 0.8, kind: "semantic" };
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
});
