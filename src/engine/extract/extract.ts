import type { DocumentCorpus, ExtractionResult, ExtractionSchema } from "../../shared/types";

export function extractFields(corpus: DocumentCorpus, schema: ExtractionSchema): ExtractionResult {
  const result: ExtractionResult = {};
  const text = corpus.fullText;
  for (const [key, field] of Object.entries(schema.fields)) {
    try {
      const re = new RegExp(field.pattern, "gi");
      const match = text.match(re);
      result[key] = match ? match[0] : null;
    } catch {
      result[key] = null;
    }
  }
  return result;
}
