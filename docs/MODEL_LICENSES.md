# Kullanılan Model ve Kaynak Lisansları

PDFE eklentisi tüm model ve dil dosyalarını paket içinde gömülü olarak kullanır;
çalışma zamanında hiçbir dış kaynaktan dosya indirilmez. Aşağıda kullanılan tüm
model/kaynak dosyaları ve lisansları listelenmiştir.

| Kaynak | Kullanım | Kaynak Adresi | Lisans |
| --- | --- | --- | --- |
| Tesseract traineddata — `tur.traineddata`, `eng.traineddata` | OCR dil verileri | https://github.com/tesseract-ocr/tessdata | Apache-2.0 |
| `Xenova/all-MiniLM-L6-v2` (ONNX: `model_quantized.onnx` + config/tokenizer) | Anlamsal arama gömme vektörleri | https://huggingface.co/Xenova/all-MiniLM-L6-v2 | Apache-2.0 (hnswlib/src: `sentence-transformers` çıktısı) |
| `Xenova/distilbart-cnn-6-6` (ONNX: `encoder_model_quantized.onnx`, `decoder_model_merged_quantized.onnx` + config/tokenizer) | Yerel özetleme | https://huggingface.co/Xenova/distilbart-cnn-6-6 | Apache-2.0 (kaynak: `facebook/distilbart-cnn-6-6`, Apache-2.0) |
| onnxruntime-web (`ort-wasm-simd-threaded.jsep.mjs/.wasm`) | ONNX model çalıştırma motoru | https://github.com/microsoft/onnxruntime | MIT |
| `@huggingface/transformers` (çalışma zamanı bağımlılığı) | Transformers.js API | https://github.com/huggingface/transformers.js | Apache-2.0 |

Not: `tessdata` deposundaki traineddata dosyaları Apache License 2.0 ile lisanslıdır
([tessdata/LICENSE](https://github.com/tesseract-ocr/tessdata/blob/main/LICENSE)).

## Eklenti Politikası

- `fetch-models.mjs` betiği bu lisanslı dosyaları indirir ve `public/models/` altına yerleştirir.
- Büyük ikili dosyalar (`.traineddata`, `.onnx`, `.wasm`) git ile sürümlenmez; temiz bir
  ortamda `npm install && npm run fetch:models && npm run build` yeterlidir.
- Adil kullanım: indirme işlemleri Tesseract ve Hugging Face tarafından sağlanan resmi
  kaynaklardan yapılır.