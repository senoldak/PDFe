import type { PDFPageProxy } from "pdfjs-dist";
import type { DocumentCorpus, EngineState, PageText, SearchResult } from "../shared/types";
import { buildCorpusFromPages, corpusHasText } from "./text/corpus";
import { mergeTextAndOcr } from "./text/merge";
import { OcrEngine } from "./ocr/ocr";
import { SemanticSearch } from "./search/semantic";

export interface PipelineDeps {
  ocr: OcrEngine;
  semantic: SemanticSearch;
  ocrLangPath: string;
  ocrCorePath: string;
  ocrWorkerPath: string;
}

export class EnginePipeline {
  private corpus: DocumentCorpus | null = null;
  private stateCb: ((s: EngineState) => void) | null = null;
  private deps: PipelineDeps;

  constructor(deps: PipelineDeps) {
    this.deps = deps;
  }

  setState(cb: (s: EngineState) => void): void {
    this.stateCb = cb;
  }

  private emit(s: Partial<EngineState>): void {
    this.stateCb?.({ ocr: "idle", ocrProgress: 0, corpusReady: false, searchReady: false, ...s });
  }

  async run(pages: PDFPageProxy[], opts: { scale: number }): Promise<DocumentCorpus> {
    this.emit({ ocr: "idle", ocrProgress: 0 });

    const textLayerPages: PageText[] = [];
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const textContent = await page.getTextContent();
      const spans = textContent.items
        .filter((it: any) => typeof it.str === "string" && it.str.trim())
        .map((it: any) => ({ text: it.str as string }));
      textLayerPages.push({
        pageNumber: i + 1,
        text: spans.map((s) => s.text).join(" "),
        spans,
        source: "textlayer",
      });
    }

    const preliminary = buildCorpusFromPages(textLayerPages);
    let finalPages = textLayerPages;

    if (!corpusHasText(preliminary)) {
      this.emit({ ocr: "loading", ocrProgress: 0.05 });
      await this.deps.ocr.init();
      const ocrPages: PageText[] = [];
      for (let i = 0; i < pages.length; i++) {
        const canvas = document.createElement("canvas");
        const viewport = pages[i].getViewport({ scale: opts.scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await pages[i].render({ canvasContext: ctx, viewport }).promise;
        const out = await this.deps.ocr.recognizePage(canvas, i + 1);
        ocrPages.push(out);
        this.emit({ ocr: "running", ocrProgress: (i + 1) / pages.length });
      }
      await this.deps.ocr.terminate();
      finalPages = mergeTextAndOcr(textLayerPages, ocrPages);
    }

    const corpus = buildCorpusFromPages(finalPages);
    this.corpus = corpus;
    this.emit({ ocr: "done", ocrProgress: 1, corpusReady: true });

    if (corpusHasText(corpus)) {
      await this.deps.semantic.init();
      await this.deps.semantic.index(corpus);
      this.emit({ searchReady: true });
    }
    return corpus;
  }

  async search(query: string): Promise<SearchResult[]> {
    if (!this.corpus) return [];
    return this.deps.semantic.search(query);
  }
}