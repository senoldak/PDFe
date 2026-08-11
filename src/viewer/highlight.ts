import type { SearchResult } from "../shared/types";

export interface TextSpanRef {
  pageNumber: number;
  spanIndex: number;
}

export function highlightSpans(containers: HTMLElement[], refs: TextSpanRef[]): number {
  for (const el of containers) el.classList.remove("pdfe-highlight");
  const pageEls = containers.map((el) => el.querySelectorAll(".textLayer span"));
  let count = 0;
  for (const ref of refs) {
    const spans = pageEls[ref.pageNumber - 1];
    const span = spans?.[ref.spanIndex] as HTMLElement | undefined;
    if (span) {
      span.classList.add("pdfe-highlight");
      count++;
    }
  }
  return count;
}

export function searchResultsToRefs(results: SearchResult[]): TextSpanRef[] {
  return results.map((r) => ({ pageNumber: r.pageNumber, spanIndex: r.spanIndex }));
}