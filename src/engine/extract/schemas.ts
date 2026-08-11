import type { ExtractionSchema } from "../../shared/types";

export const INVOICE_SCHEMA: ExtractionSchema = {
  fields: {
    faturaNo: { label: "Fatura No", pattern: "\\b(?:[A-Z]{1,3}\\s?)?\\d{3,10}\\b" },
    tarih: { label: "Tarih", pattern: "\\b\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}\\b" },
    tutar: { label: "Tutar", pattern: "(?:\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+\\.\\d{2}(?![\\d.]))\\s?(?:TL|₺|TRY)?\\b" },
    kdv: { label: "KDV", pattern: "(?:KDV|K.D.V.)\\s*(?:%\\s*)?\\d{1,2}" },
    iban: { label: "IBAN", pattern: "\\bTR\\d{2}\\s?(?:\\d{4}\\s?){5}\\d{2}\\b" },
    tedarikci: { label: "Tedarikçi", pattern: "(?<=Tedarikçi\\s*:\\s*)[A-Z][^\\n,;]{2,60}" },
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
