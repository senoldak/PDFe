import type { PageText } from "../../shared/types";

export function mergeTextAndOcr(textLayer: PageText[], ocr: PageText[]): PageText[] {
  const ocrByPage = new Map(ocr.map((p) => [p.pageNumber, p]));
  const out: PageText[] = [];
  for (const page of textLayer) {
    const ocrPage = ocrByPage.get(page.pageNumber);
    if (page.text.trim().length === 0 && ocrPage && ocrPage.text.trim().length > 0) {
      out.push({ ...ocrPage, source: "ocr" });
    } else {
      out.push(page);
    }
  }
  for (const p of ocr) {
    if (!textLayer.some((t) => t.pageNumber === p.pageNumber)) out.push(p);
  }
  return out.sort((a, b) => a.pageNumber - b.pageNumber);
}
