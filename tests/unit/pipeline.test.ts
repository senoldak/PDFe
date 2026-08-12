import { describe, expect, it, vi } from "vitest";
import { EnginePipeline } from "../../src/engine/pipeline";
import { OcrEngine } from "../../src/engine/ocr/ocr";
import { SemanticSearch } from "../../src/engine/search/semantic";
import type { DocumentCorpus, PageText } from "../../src/shared/types";

function mockPage(text: string): any {
  return {
    getTextContent: vi.fn().mockResolvedValue({
      items: text.split(/\s+/).filter(Boolean).map((s) => ({ str: s })),
    }),
    getViewport: vi.fn().mockReturnValue({ width: 100, height: 200, scale: 1 }),
    render: vi.fn().mockResolvedValue({ promise: Promise.resolve() }),
  };
}

function fakeOcr(): OcrEngine {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    recognizePage: vi.fn().mockImplementation(async (_c, n) => ({ pageNumber: n, text: `ocr${n}`, spans: [], source: "ocr" }) as PageText),
    terminate: vi.fn().mockResolvedValue(undefined),
    setProgress: vi.fn(),
  } as unknown as OcrEngine;
}

function fakeSemantic(): SemanticSearch {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    index: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
  } as unknown as SemanticSearch;
}

describe("EnginePipeline", () => {
  it("builds corpus from digital text without OCR", async () => {
    const pipeline = new EnginePipeline({
      ocr: fakeOcr(),
      semantic: fakeSemantic(),
      ocrLangPath: "/", ocrCorePath: "/", ocrWorkerPath: "/",
    });
    const states: any[] = [];
    pipeline.setState((s) => states.push(s));
    const corpus = await pipeline.run([mockPage("merhaba dunya")], { scale: 1 });
    expect(corpus.fullText).toContain("merhaba");
    expect((pipeline as any).deps.ocr.init).not.toHaveBeenCalled();
    expect(states.some((s) => s.corpusReady)).toBe(true);
  });

  it("falls back to OCR when text is empty", async () => {
    const ocr = fakeOcr();
    const pipeline = new EnginePipeline({
      ocr,
      semantic: fakeSemantic(),
      ocrLangPath: "/", ocrCorePath: "/", ocrWorkerPath: "/",
    });
    const corpus = await pipeline.run([mockPage("   ") as any], { scale: 1 });
    expect(ocr.init).toHaveBeenCalled();
    expect(corpus.fullText).toContain("ocr1");
  });
  it("emits ocr failed and rejects when OCR engine fails", async () => {
    const ocr = fakeOcr();
    (ocr.init as any).mockRejectedValue(new Error("ocr init failed"));
    const pipeline = new EnginePipeline({
      ocr,
      semantic: fakeSemantic(),
      ocrLangPath: "/", ocrCorePath: "/", ocrWorkerPath: "/",
    });
    const states: any[] = [];
    pipeline.setState((s) => states.push(s));
    await expect(pipeline.run([mockPage("   ") as any], { scale: 1 })).rejects.toThrow("ocr init failed");
    expect(states.some((s) => s.ocr === "failed")).toBe(true);
  });
});