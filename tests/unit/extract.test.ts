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
