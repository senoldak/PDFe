import type { DocumentCorpus, PageText } from "../../shared/types";

export function buildCorpusFromPages(pages: PageText[]): DocumentCorpus {
  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  return {
    pages: sorted,
    fullText: sorted.map((p) => p.text).join("\n\n"),
  };
}

export function corpusHasText(corpus: DocumentCorpus): boolean {
  return corpus.fullText.trim().length > 0;
}
