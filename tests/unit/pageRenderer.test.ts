import { describe, expect, it, vi } from "vitest";
import type { PDFPageProxy } from "pdfjs-dist";

const mockCtx = {
  canvas: { width: 0, height: 0 },
  font: "",
  measureText: () => ({ width: 10, fontBoundingBoxAscent: 0.8, fontBoundingBoxDescent: 0.2 }),
} as unknown as CanvasRenderingContext2D;
HTMLCanvasElement.prototype.getContext = (() => mockCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext;

function mockPage(): PDFPageProxy {
  const viewport = { width: 100, height: 200, scale: 1, rotation: 0, rawDims: { pageWidth: 100, pageHeight: 200, pageX: 0, pageY: 0 } };
  return {
    getViewport: (opts: any) => ({ ...viewport, scale: opts.scale }),
    render: vi.fn().mockResolvedValue({ promise: Promise.resolve() }),
    getTextContent: vi.fn().mockResolvedValue({
      styles: { f1: { fontFamily: "sans-serif", ascent: 0.75, descent: 0, vertical: false } },
      items: [{ type: "text", fontName: "f1", str: "merhaba", dir: "ltr", width: 10, height: 10, transform: [1, 0, 0, 1, 0, 0], hasEOL: false }],
    }),
    cleanup: vi.fn(),
  } as unknown as PDFPageProxy;
}

describe("renderPage", () => {
  it("returns text spans from text content", async () => {
    const { renderPage } = await import("../../src/viewer/pageRenderer");
    const page = mockPage();
    const canvas = document.createElement("canvas");
    const container = document.createElement("div");
    const result = await renderPage(page, canvas, container, 1);
    expect(result.textSpans.length).toBe(1);
    expect(result.textSpans[0].text).toBe("merhaba");
  });
});
