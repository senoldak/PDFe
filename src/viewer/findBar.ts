export interface FindResult {
  pageNumber: number;
  spanIndex: number;
  text: string;
}

interface FindableSpan {
  text: string;
  pageNumber?: number;
}

export function findInSpans(
  spans: FindableSpan[],
  query: string,
  regex = false
): FindResult[] {
  if (!query) return [];
  const results: FindResult[] = [];
  try {
    const re = regex ? new RegExp(query, "gi") : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    spans.forEach((span, idx) => {
      re.lastIndex = 0;
      if (re.test(span.text)) results.push({ pageNumber: span.pageNumber ?? -1, spanIndex: idx, text: span.text });
    });
  } catch {
    return [];
  }
  return results;
}