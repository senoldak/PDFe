# PDFE Model Dosyaları

Bu dizin, Akıllı Motor'un kullandığı model dosyalarını barındırır. Tüm modeller
eklentiyle birlikte gömülüdür; çalışma zamanında hiçbir şey indirilmez ve hiçbir
içerik cihazdan dışarı çıkmaz.

## Yapı

- `tessdata/` — OCR dil verileri (`tur`, `eng` Tesseract traineddata)
- `onnx/Xenova/all-MiniLM-L6-v2/` — anlamsal arama (embedding) ONNX modeli + config/tokenizer
- `onnx/Xenova/distilbart-cnn-6-6/` — özetleme ONNX modelleri (encoder + decoder) + config/tokenizer
- `ort/` — onnxruntime-web WASM dosyaları (`ort-wasm-simd-threaded.jsep.mjs/.wasm`)

## Kurulum

İkili dosyalar git'te sürümlenmez; temiz bir ortamda indirmek için:

```bash
npm run fetch:models
```

Bu komut model, tokenizer, config ve traineddata dosyalarını resmi kaynaklardan
indirir, onnxruntime WASM dosyalarını `node_modules`'dan kopyalar. Ardından normal
derleme yapılır:

```bash
npm run build
```

Model dosyalarının lisans bilgileri `docs/MODEL_LICENSES.md` klasöründe belgelenir.
