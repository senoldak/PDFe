import { createWorker, type Worker } from "tesseract.js";
import type { Bbox, PageText, TextSpan } from "../../shared/types";

export interface OcrOptions {
  langPath: string;
  corePath: string;
  workerPath: string;
  lang: string;
  gzip?: boolean;
}

export class OcrEngine {
  private worker: Worker | null = null;
  private progressCb: ((p: number) => void) | null = null;
  private options: OcrOptions;

  constructor(options: OcrOptions) {
    this.options = options;
  }

  setProgress(cb: (p: number) => void): void {
    this.progressCb = cb;
  }

  async init(): Promise<void> {
    this.worker = await createWorker(this.options.lang, 1, {
      langPath: this.options.langPath,
      corePath: this.options.corePath,
      workerPath: this.options.workerPath,
      gzip: this.options.gzip ?? false,
      logger: (m) => {
        if (m.status === "recognizing text" && this.progressCb) {
          this.progressCb(m.progress);
        }
      },
    });
  }

  async recognizePage(canvas: HTMLCanvasElement, pageNumber: number): Promise<PageText> {
    if (!this.worker) throw new Error("OcrEngine not initialized");
    const { data } = await this.worker.recognize(canvas, {}, { text: true, blocks: true });
    const spans: TextSpan[] = [];
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        for (const line of para.lines ?? []) {
          for (const word of line.words ?? []) {
            const b = word.bbox as Bbox;
            spans.push({ text: word.text, bbox: b, confidence: word.confidence });
          }
        }
      }
    }
    return {
      pageNumber,
      text: data.text,
      spans,
      source: "ocr",
    };
  }

  async terminate(): Promise<void> {
    await this.worker?.terminate();
    this.worker = null;
  }
}