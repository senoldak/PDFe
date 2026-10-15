### Task 15: Model dosyaları paketleme + çevrimdışı garanti

**Files:**
- Create: `scripts/fetch-models.mjs`
- Create: `public/models/tessdata/README.md`
- Modify: `package.json` (postinstall / build hook)
- Modify: `docs/` (MODEL_LICENSES.md)
- Test: build sonrası `dist/models` kontrolü

**Interfaces:**
- Consumes: —
- Produces: `npm run fetch:models` → `public/models/` içine `tessdata/tur.traineddata`, `tessdata/eng.traineddata`, `onnx/` (embedding + özetleme). Build bunları `dist/models/`'e kopyalar (Task 1 copy-static zaten `models/*` kopyalar).

- [ ] **Step 1: scripts/fetch-models.mjs yaz**

```js
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dest = resolve(root, "public/models");
mkdirSync(dest, { recursive: true });

async function download(url, file) {
  const out = resolve(dest, file);
  if (existsSync(out)) { console.log("skip", file); return; }
  mkdirSync(dirname(out), { recursive: true });
  console.log("downloading", file, "...");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(out, buf);
  console.log("saved", file, buf.length, "bytes");
}

const jobs = [
  // tessdata
  ["https://tessdata.projectnaptha.com/4.0.0/tur.traineddata", "tessdata/tur.traineddata"],
  ["https://tessdata.projectnaptha.com/4.0.0/eng.traineddata", "tessdata/eng.traineddata"],
  // transformers.js ONNX modelleri (HuggingFace, Xenova/mixedbread-ai vb.)
  ["https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx", "onnx/embedding/model.onnx"],
  ["https://huggingface.co/Xenova/distilbart-cnn-6-6/resolve/main/onnx/encoder_model_quantized.onnx", "onnx/summarize/encoder.onnx"],
  ["https://huggingface.co/Xenova/distilbart-cnn-6-6/resolve/main/onnx/decoder_model_quantized.onnx", "onnx/summarize/decoder.onnx"],
];

for (const [url, file] of jobs) {
  try { await download(url, file); } catch (e) { console.error("FAILED", file, e.message); }
}
```

> Not: transformers.js `env.localModelPath` model JSON/tokenizer dosyalarını da ister; `fetch-models.mjs` model klasörlerinin tam içeriğini (tokenizer.json, config.json, tokenizer_config.json, vocab) `https://huggingface.co/Xenova/<model>/resolve/main/<file>` kalıbıyla indirmeli. Bu görevde en az ONNX + config + tokenizer indirilir; eksik dosyalar çalışma anında `env.allowRemoteModels=false` ile hata verir — dolayısıyla indirme listesi modelin HF repo file listesiyle eşleşmeli.

- [ ] **Step 2: package.json'a script ekle**

Modify `package.json`:
```json
"scripts": {
  "fetch:models": "node scripts/fetch-models.mjs"
}
```

- [ ] **Step 3: src/engine/runtime.ts yaz** — model yollarını tek yerden çöz

```ts
import { env } from "@huggingface/transformers";

export function configureRuntime(): void {
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.localModelPath = chrome.runtime.getURL("models/onnx/");
}
```
`viewer.ts` içinde `configureRuntime()`'ı ilk satırda çağır.

- [ ] **Step 4: docs/MODEL_LICENSES.md yaz**

```md
# Model Lisansları

| Model | Kaynak | Lisans |
|---|---|---|
| tur.traineddata / eng.traineddata | tessdata.projectnaptha.com (Tesseract) | Apache 2.0 |
| Xenova/all-MiniLM-L6-v2 | Hugging Face | Apache 2.0 |
| Xenova/distilbart-cnn-6-6 | Hugging Face | Apache 2.0 |
```

- [ ] **Step 5: modelleri indir + build ile doğrula**

Run: `npm run fetch:models && npm run build`
Expected: `public/models/` ve ardından `dist/models/` dolu. Hata yok.

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-models.mjs public/models README? src/engine/runtime.ts docs/MODEL_LICENSES.md package.json
git commit -m "feat: bundle offline model files with per-model licensing"
```
> Not: `public/models` içindeki büyük binary dosyalar git'e eklenebilir veya `.gitignore` ile hariç tutulup `npm run fetch:models` ile çekilebilir. Portfolyo repo'sunda ikili dosyaları hariç tutmak önerilir: `public/models/` yerine `.gitignore`'a `public/models/*` ekle ve README'de `npm run fetch:models` talimatını belirt.

---