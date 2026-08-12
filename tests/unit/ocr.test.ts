import { describe, expect, it, vi } from "vitest";
import { createWorker } from "tesseract.js";
import { OcrEngine } from "../../src/engine/ocr/ocr";

vi.mock("tesseract.js", () => {
  const recognize = vi.fn().mockResolvedValue({
    data: {
      text: "FATURA\nNo: 123",
      blocks: [
        {
          paragraphs: [
            { lines: [{ words: [{ text: "FATURA", bbox: { x0: 1, y0: 1, x1: 9, y1: 5 }, confidence: 0.9 }] }] },
          ],
        },
      ],
    },
  });
  return {
    createWorker: vi.fn().mockResolvedValue({ recognize, terminate: vi.fn().mockResolvedValue(undefined) }),
  };
});

describe("OcrEngine", () => {
  it("recognizes a page into PageText with spans", async () => {
    const engine = new OcrEngine({ langPath: "/", corePath: "/", workerPath: "/", lang: "tur" });
    await engine.init();
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const out = await engine.recognizePage(canvas, 1);
    expect(out.source).toBe("ocr");
    expect(out.pageNumber).toBe(1);
    expect(out.text).toContain("FATURA");
    expect(out.spans[0].bbox).toEqual({ x0: 1, y0: 1, x1: 9, y1: 5 });
  });
  it("throws when not initialized", async () => {
    const engine = new OcrEngine({ langPath: "/", corePath: "/", workerPath: "/", lang: "tur" });
    await expect(engine.recognizePage({} as HTMLCanvasElement, 1)).rejects.toThrow("not initialized");
  });
  it("terminates the previous worker on re-init", async () => {
    const engine = new OcrEngine({ langPath: "/", corePath: "/", workerPath: "/", lang: "tur" });
    await engine.init();
    const worker = await (createWorker as any).mock.results[0].value;
    await engine.init();
    expect(worker.terminate).toHaveBeenCalled();
  });
  it("passes worker/core/lang paths and gzip:false when unset", async () => {
    const engine = new OcrEngine({ langPath: "/lp", corePath: "/cp", workerPath: "/wp", lang: "tur" });
    await engine.init();
    const [, , opts] = (createWorker as any).mock.calls.at(-1);
    expect(opts).toMatchObject({ langPath: "/lp", corePath: "/cp", workerPath: "/wp", gzip: false });
  });
  it("forwards recognizing text progress via the logger", async () => {
    const engine = new OcrEngine({ langPath: "/", corePath: "/", workerPath: "/", lang: "tur" });
    const onProgress = vi.fn();
    engine.setProgress(onProgress);
    await engine.init();
    const logger = (createWorker as any).mock.calls.at(-1)[2].logger;
    logger({ status: "recognizing text", progress: 0.33 });
    expect(onProgress).toHaveBeenCalledWith(0.33);
    logger({ status: "done", progress: 1 });
    expect(onProgress).toHaveBeenCalledTimes(1);
  });
});