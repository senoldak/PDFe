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

## Gizlilik

Eklenti tamamen yerel çalışır: OCR, anlamsal arama, özetleme ve veri çıkarma tümüyle
cihazınızda gerçekleşir; PDF içeriği hiçbir sunucuya gönderilmez. Ayrıntılar:
`docs/PRIVACY.md`.

## Lisans
Apache 2.0 — bkz. `LICENSE`. Model ağırlıkları: `docs/MODEL_LICENSES.md`.