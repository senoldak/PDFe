# Tesseract traineddata

Bu dizin OCR için gerekli dil verilerini içerir.

- `tur.traineddata` — Türkçe OCR
- `eng.traineddata` — İngilizce OCR

Dosyalar `npm run fetch:models` çalıştırıldığında
`https://raw.githubusercontent.com/tesseract-ocr/tessdata/main/<dil>.traineddata`
adresinden indirilir (tessdata deposu, Apache-2.0 lisansı). Kaynak:
https://github.com/tesseract-ocr/tessdata

Lisans ayrıntıları için: `docs/MODEL_LICENSES.md`