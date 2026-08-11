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
    const pageCounts = new Map<number, number>();
    spans.forEach((span) => {
      re.lastIndex = 0;
      const pageNumber = span.pageNumber ?? -1;
      const spanIndex = pageCounts.get(pageNumber) ?? 0;
      pageCounts.set(pageNumber, spanIndex + 1);
      if (re.test(span.text)) results.push({ pageNumber, spanIndex, text: span.text });
    });
  } catch {
    return [];
  }
  return results;
}