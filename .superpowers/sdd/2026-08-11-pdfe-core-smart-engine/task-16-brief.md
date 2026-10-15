### Task 16: README, gizlilik politikası, örnek PDF'ler

**Files:**
- Create: `README.md`
- Create: `docs/PRIVACY.md`
- Create: `LICENSE` (Apache 2.0 tam metni)
- Create: `NOTICE` (derleme bilgisi)
- Create: `tests/fixtures/` — iki örnek PDF (biri dijital metinli, biri taranmış/boş text layer)
- Modify: `public/models/.gitignore` (ikili dosyalar için)

**Interfaces:**
- Consumes: —
- Produces: Dokümantasyon + e2e testlerinin kullanacağı fixture PDF'ler. Fixture üretimi için `scripts/make-fixtures.mjs` (pdf-lib veya pdfjs-dist getDocument ile üretilir; en basiti: pdf-lib kullanmadan elle minimal PDF bytes yazmak — aşağıda verilen sabit küçük PDF şablonu). Taranmış PDF fixtüresi: aynı PDF'in text layer'ı boş bırakılarak üretilir.

- [ ] **Step 1: scripts/make-fixtures.mjs yaz** — minimal geçerli iki PDF üretir

```js
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

mkdirSync("tests/fixtures", { recursive: true });

function minimalPdf(text) {
  const objs = [];
  const content = `BT\n${text}\nET`;
  const stream = Buffer.from(content).toString("base64");
  objs.push(`1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`);
  objs.push(`2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`);
  objs.push(`3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj`);
  objs.push(`4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`);
  objs.push(`5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`);
  return `%PDF-1.4\n${objs.join("\n")}\ntrailer << /Root 1 0 R /Size 6 >>\n%%EOF`;
}

// Dijital metinli PDF (text layer dolu)
writeFileSync(resolve("tests/fixtures/digital.pdf"), minimalPdf("Vergi dairesi FATURA No 2026/0001 Tarih 15.03.2026 Tutar 1.250,00 TL"));

// Taranmış PDF: text layer'ı boş — pdfjs-dist textContent boş döner (content stream'i boş)
writeFileSync(resolve("tests/fixtures/scanned.pdf"), minimalPdf(""));
console.log("fixtures written");
```
> Not: `minimalPdf` içinde text olmaması pdfjs-dist'in boş textContent döndürmesini garanti etmez (font/glyph üretimi yoktur — boş BT/ET stream'i boş içerik üretir). Bu fixture OCR yolunu tetiklemek için yeterli kabul edilir; e2e'de OCR gerçek model gerektirdiğinden OCR e2e testi işaretlenip `test.skip` ile atlanır, dijital fixture testi aktif çalışır.

- [ ] **Step 2: README.md yaz** (vizyon, kurulum, build, yükleme, test, lisans, özellikler)

```md
# PDFE — Yerel Akıllı PDF

Tarayıcıda açılan PDF'leri tamamen **yerel** akıllı araçlarla işleyen Chrome eklentisi:
OCR, anlamsal arama, özetleme ve veri çıkarma. Hiçbir içerik cihazdan çıkmaz.

## Özellikler

- pdfjs-dist tabanlı özel viewer (sayfa gezinme, zoom, arama, highlight)
- Yerel OCR (Tesseract.js) — taranmış belgeleri okunur metne çevirir
- Anlamsal arama (transformers.js embedding) — kavramsal eşleşme
- Özetleme (yerel BART modeli)
- Veri çıkarma (fatura: No, tarih, tutar, KDV, IBAN, tedarikçi)

## Kurulum

```bash
npm install
npm run fetch:models   # model dosyalarını indirir (çevrimdışı çalışma için)
npm run build
```

Chrome → `chrome://extensions` → Geliştirici modu → "Paketlenmemiş öğe yükle" → `dist/` klasörünü seç.

## Test

```bash
npm test          # birim testler (vitest)
npm run test:e2e  # e2e (playwright) — eklenti yüklenir, viewer akışı doğrulanır
```

## Lisans
Apache 2.0 — bkz. `LICENSE`. Model ağırlıkları: `docs/MODEL_LICENSES.md`.
```

- [ ] **Step 3: docs/PRIVACY.md yaz**

```md
# Gizlilik Politikası

PDFE tüm işlemleri yerel olarak yapar. Uygulama:

- PDF içeriğini hiçbir sunucuya göndermez.
- Analitik, telemetri veya çerez kullanmaz.
- Model dosyalarını eklenti paketinden yükler (çevrimdışı çalışır).
- Kullanıcı verisi toplamaz, saklamaz, paylaşmaz.

PDF dosyaları yalnızca tarayıcı içinde, eklentinin viewer'ında işlenir.
```

- [ ] **Step 4: public/models/.gitignore yaz**

```
*
!README.md
```

- [ ] **Step 5: LICENSE ve NOTICE yaz** (Apache 2.0 — tam metin için https://www.apache.org/licenses/LICENSE-2.0.txt adresinden indir)

```bash
Invoke-WebRequest -Uri "https://www.apache.org/licenses/LICENSE-2.0.txt" -OutFile "LICENSE"
```

`NOTICE`:
```
PDFE
Copyright 2026 PDFE contributors

PDFE, Apache 2.0 lisansıyla dağıtılmaktadır.
Gömülü üçüncü taraf bileşenlerin lisansları için docs/MODEL_LICENSES.md ve
package.json bağımlılık listesine bakınız.
```

- [ ] **Step 6: fixture üret + test + build**

Run: `node scripts/make-fixtures.mjs && npm run test && npm run build`
Expected: fixtures oluşur, testler PASS.

- [ ] **Step 7: Commit**

```bash
git add README.md docs/PRIVACY.md LICENSE NOTICE scripts/make-fixtures.mjs tests/fixtures public/models/.gitignore
git commit -m "docs: add README, license, privacy policy and test fixtures"
```

---