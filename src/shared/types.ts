export interface Bbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TextSpan {
  text: string;
  bbox?: Bbox;
  confidence?: number;
}

export interface PageText {
  pageNumber: number;
  text: string;
  spans: TextSpan[];
  source: "textlayer" | "ocr";
}

export interface DocumentCorpus {
  pages: PageText[];
  fullText: string;
}

export interface SearchResult {
  pageNumber: number;
  spanIndex: number;
  span: TextSpan;
  score: number;
  kind: "semantic" | "literal" | "regex";
}

export interface ExtractionResult {
  [field: string]: string | number | null;
}

export type OcrStatus = "idle" | "loading" | "running" | "done" | "failed";
export type EngineState = {
  ocr: OcrStatus;
  ocrProgress: number; // 0..1
  corpusReady: boolean;
  searchReady: boolean;
};

export interface ExtractionSchema {
  fields: Record<string, { label: string; pattern: string }>;
}