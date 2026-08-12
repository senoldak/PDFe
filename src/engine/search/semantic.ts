import { pipeline } from "@huggingface/transformers";
import type { DocumentCorpus, SearchResult, TextSpan } from "../../shared/types";

const MODEL = "Xenova/all-MiniLM-L6-v2";

type FeatureExtractionPipeline = (texts: string[], opts?: { pooling?: string; normalize?: boolean }) => Promise<{ tolist(): number[][] }>;

interface IndexedSentence {
  pageNumber: number;
  spanIndex: number;
  text: string;
  span: TextSpan;
  embedding: number[];
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export class SemanticSearch {
  private extractor: FeatureExtractionPipeline | null = null;
  private indexed: IndexedSentence[] = [];

  async init(): Promise<void> {
    this.extractor = (await pipeline("feature-extraction", MODEL, { dtype: "q8" })) as unknown as FeatureExtractionPipeline;
  }

  async index(corpus: DocumentCorpus): Promise<void> {
    if (!this.extractor) throw new Error("SemanticSearch not initialized");
    this.indexed = [];
    const sentences: { pageNumber: number; spanIndex: number; text: string; span: TextSpan }[] = [];
    for (const page of corpus.pages) {
      page.spans.forEach((span, i) => {
        const t = span.text.trim();
        if (t.length > 1) sentences.push({ pageNumber: page.pageNumber, spanIndex: i, text: t, span });
      });
    }
    if (!sentences.length) return;
    const chunks: string[][] = [];
    for (let i = 0; i < sentences.length; i += 64) {
      chunks.push(sentences.slice(i, i + 64).map((s) => s.text));
    }
    for (let c = 0; c < chunks.length; c++) {
      const out = await this.extractor!(chunks[c], { pooling: "mean", normalize: true });
      const rows = out.tolist();
      rows.forEach((emb, j) => {
        const s = sentences[c * 64 + j];
        this.indexed.push({ pageNumber: s.pageNumber, spanIndex: s.spanIndex, text: s.text, span: s.span, embedding: emb });
      });
    }
  }

  async search(query: string, topK = 5): Promise<SearchResult[]> {
    if (!this.extractor) throw new Error("SemanticSearch not initialized");
    if (!this.indexed.length) return [];
    const [qEmb] = (await this.extractor([query], { pooling: "mean", normalize: true })).tolist();
    const scored = this.indexed
      .map((s) => ({ ...s, score: cosine(qEmb, s.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return scored.map((s): SearchResult => ({
      pageNumber: s.pageNumber,
      spanIndex: s.spanIndex,
      span: { ...s.span, text: s.text },
      score: s.score,
      kind: "semantic",
    }));
  }
}
