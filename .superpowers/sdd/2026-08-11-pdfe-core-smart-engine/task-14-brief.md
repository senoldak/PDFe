### Task 14: Akıllı Panel — veri çıkarma

**Files:**
- Create: `src/engine/extract/extract.ts`
- Create: `src/engine/extract/schemas.ts`
- Modify: `src/viewer/smartPanel.ts`
- Test: `tests/unit/extract.test.ts`

**Interfaces:**
- Consumes: `ExtractionResult`, `ExtractionSchema` (Task 2)
- Produces: `extractFields(corpus: DocumentCorpus, schema: ExtractionSchema): ExtractionResult` — Türkçe fatura şeması (`faturaNo`, `tarih`, `tutar`, `kdv`, `iban`, `tedarikci`).

- [ ] **Step 1: src/engine/extract/schemas.ts yaz**

```ts
import type { ExtractionSchema } from "../../shared/types";

export const INVOICE_SCHEMA: ExtractionSchema = {
  fields: {
    faturaNo: { label: "Fatura No", pattern: "\\b(?:[A-Z]{1,3}\\s?)?\\d{3,10}\\b" },
    tarih: { label: "Tarih", pattern: "\\b\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}\\b" },
    tutar: { label: "Tutar", pattern: "(?:\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+\\.\\d{2})\\s?(?:TL|₺|TRY)?\\b" },
    kdv: { label: "KDV", pattern: "(?:KDV|K.D.V.)\\s*(?:%\\s*)?\\d{1,2}" },
    iban: { label: "IBAN", pattern: "\\bTR\\d{2}\\s?(?:\\d{4}\\s?){5}\\d{2}\\b" },
    tedarikci: { label: "Tedarikçi", pattern: "\\b[A-Z][^\\n,;]{5,60}\\b" },
  },
};

export const GENERAL_SCHEMA: ExtractionSchema = {
  fields: {
    email: { label: "E-posta", pattern: "[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+" },
    telefon: { label: "Telefon", pattern: "(?:\\+90\\s?|0\\s?)?(?:\\d{3}\\s?\\d{3}\\s?\\d{2}\\s?\\d{2}|\\d{10})" },
    tcNo: { label: "TC Kimlik No", pattern: "\\b\\d{11}\\b" },
    tarih: { label: "Tarih", pattern: "\\b\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}\\b" },
  },
};
```

- [ ] **Step 2: src/engine/extract/extract.ts yaz**

```ts
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
```

- [ ] **Step 3: tests/unit/extract.test.ts yaz**

```ts
import { describe, expect, it } from "vitest";
import { extractFields } from "../../src/engine/extract/extract";
import { GENERAL_SCHEMA, INVOICE_SCHEMA } from "../../src/engine/extract/schemas";
import type { DocumentCorpus } from "../../src/shared/types";

function corpus(text: string): DocumentCorpus {
  return { pages: [{ pageNumber: 1, text, spans: [], source: "textlayer" }], fullText: text };
}

describe("extractFields", () => {
  it("extracts invoice fields", () => {
    const text = "FATURA No: 2026/0001\nTarih: 15.03.2026\nTutar: 1.250,00 TL\nKDV %20\nIBAN TR12 0001 2003 1234 5678 9012 34\nTedarikçi: Acme Ltd";
    const r = extractFields(corpus(text), INVOICE_SCHEMA);
    expect(r.faturaNo).toMatch(/\d{3,10}/);
    expect(r.tarih).toBe("15.03.2026");
    expect(r.tutar).toBe("1.250,00 TL");
    expect(r.kdv).toContain("20");
    expect(r.iban).toContain("TR12");
    expect(r.tedarikci).toBe("Acme Ltd");
  });
  it("extracts general fields", () => {
    const text = "Mail: ali@ornek.com Tel: 0532 123 45 67 TC: 12345678901";
    const r = extractFields(corpus(text), GENERAL_SCHEMA);
    expect(r.email).toBe("ali@ornek.com");
    expect(r.telefon).toContain("0532");
    expect(r.tcNo).toBe("12345678901");
  });
  it("returns null for missing fields", () => {
    const r = extractFields(corpus("bos"), INVOICE_SCHEMA);
    expect(r.iban).toBeNull();
  });
});
```

- [ ] **Step 4: smartPanel.ts'ye çıkarma butonu bağla**

Modify `src/viewer/smartPanel.ts`: `SmartPanelCallbacks`'a `getCorpus` ekli zaten (Task 13); `#extractBtn` tıklanınca `extractFields(getCorpus()!, INVOICE_SCHEMA)` çağırıp `#extractOutput`'a tablo olarak yaz.

- [ ] **Step 5: test + typecheck + build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/extract src/viewer/smartPanel.ts tests/unit/extract.test.ts
git commit -m "feat: add template-based data extraction for invoices and general fields"
```

---