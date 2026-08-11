import { TextLayer, type PageViewport } from "pdfjs-dist";
import type { PDFPageProxy } from "pdfjs-dist";
import type { TextSpan } from "../shared/types";

export interface RenderedPage {
  textSpans: TextSpan[];
  canvas: HTMLCanvasElement;
}

export async function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  scale: number
): Promise<RenderedPage> {
  const viewport = page.getViewport({ scale });
  const outputScale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport, transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined }).promise;

  const textDiv = document.createElement("div");
  textDiv.className = "textLayer";
  container.appendChild(textDiv);

  const textContent = await page.getTextContent();
  const textLayer = new TextLayer({
    textContentSource: textContent,
    container: textDiv,
    viewport,
  });
  await textLayer.render();

  const spans: TextSpan[] = [];
  for (const item of textContent.items) {
    const s = item as any;
    if (typeof s.str === "string" && s.str.trim()) {
      spans.push({ text: s.str, bbox: s.transform ? undefined : undefined, confidence: undefined });
    }
  }
  return { textSpans: spans, canvas };
}
