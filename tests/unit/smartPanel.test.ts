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
    expect(panel.querySelector<HTMLElement>("#ocrProgressWrap")!.hidden).toBe(true);
  });
});
