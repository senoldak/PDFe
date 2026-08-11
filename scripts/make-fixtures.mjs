import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

mkdirSync("tests/fixtures", { recursive: true });

function pdfText(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function minimalPdf(text) {
  const objs = [];
  const content = text ? `BT\n/F1 12 Tf\n(${pdfText(text)}) Tj\nET` : `BT\nET`;
  objs.push(`1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`);
  objs.push(`2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`);
  objs.push(`3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj`);
  objs.push(`4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`);
  objs.push(`5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`);
  return `%PDF-1.4\n${objs.join("\n")}\ntrailer << /Root 1 0 R /Size 6 >>\n%%EOF`;
}

// Dijital metinli PDF (text layer dolu)
writeFileSync(resolve("tests/fixtures/digital.pdf"), minimalPdf("Vergi dairesi FATURA No 2026/0001 Tarih 15.03.2026 Tutar 1.250,00 TL"));

// Taranmış PDF: text layer'ı boş — pdfjs-dist textContent boş döner (content stream'i boş)
writeFileSync(resolve("tests/fixtures/scanned.pdf"), minimalPdf(""));
console.log("fixtures written");