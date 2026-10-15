# Task 15 Report: Model dosyaları paketleme + çevrimdışı garanti (models packaging + offline runtime wiring)

**Status:** DONE_WITH_CONCERNS

## Summary

Packaged every model/worker/language asset the Smart Engine needs into the extension
and wired transformers.js `env` so nothing is fetched from a remote CDN at runtime.
`npm run fetch:models` downloads Tesseract traineddata + both ONNX models (with full
config/tokenizer skeletons) into `public/models/`, copies the onnxruntime WASM files
from `node_modules`, and the build copies everything into `dist/models/`.

## Files

- Created `scripts/fetch-models.mjs` — downloader with retries (4x, backoff) & parallel
  pool (concurrency 3), stream-to-disk writes, `.part` temp files, skip-if-exists.
  Also copies `ort-wasm-simd-threaded.jsep.{mjs,wasm}` from `node_modules/@huggingface/transformers/dist/`
  into `public/models/ort/`.
- Created `src/engine/runtime.ts` — `configureRuntime()` sets
  `env.allowLocalModels=true`, `env.allowRemoteModels=false`,
  `env.localModelPath=chrome.runtime.getURL("models/onnx/")` and
  `env.backends.onnx.wasm.wasmPaths=chrome.runtime.getURL("models/ort/")`.
- Modified `src/viewer/viewer.ts` — imported `configureRuntime` and call it as the
  FIRST line of `init()` (line 46). `semantic.init()`/`summarizer.init()` run lazily
  inside `pipeline.run()` (pipeline.ts:78) / UI actions, so the env is always set
  before the first `pipeline()` call in the shipped path.
- Modified `package.json` — added `"fetch:models": "node scripts/fetch-models.mjs"`.
- Created `docs/MODEL_LICENSES.md` — per-model license table (all Apache-2.0/MIT).
- Created `public/models/tessdata/README.md` — tessdata provenance/license.
- Updated `public/models/README.md` — layout + `npm run fetch:models` instructions.
- Updated `.gitignore` — model binaries excluded from git (fetch + build regenerate them).

## Verification

- `npm run fetch:models` — all 17 model/config/tokenizer files downloaded, sizes
  byte-verified against the authoritative HF API (`?blobs=true`) and GitHub raw.
- `npm run typecheck` — clean.
- `npx vitest run` — 32 tests / 13 files pass.
- `npm run build` — clean; `dist/models/` contains 21 files: tessdata (tur 18.75MB,
  eng 23.46MB), MiniLM onnx (22.97MB), distilbart encoder (128.82MB) + decoder
  (155.10MB), all configs/tokenizers, ort wasm (mjs 44KB + wasm 21.6MB).
- Commit `d67fee6` "feat: bundle models for offline use with fetch script" (exact brief message).

## Deviations from brief (concerns)

1. **tessdata source URL is dead.** `https://tessdata.projectnaptha.com/4.0.0/{tur,eng}.traineddata`
   returns 404 (both tessdata and tessdata_fast paths). Switched to the canonical,
   equally-licensed GitHub raw `tesseract-ocr/tessdata/main/*.traineddata` (Apache-2.0).
2. **ONNX layout must mirror the HF repo, not the brief's flat example.** transformers.js
   v3 resolves `<localModelPath>/<model_id>/<filename>` (e.g.
   `models/onnx/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx`). The brief's example
   paths (`onnx/embedding/model.onnx`, `onnx/summarize/encoder.onnx`) are NOT what the
   runtime resolves; using them would throw "Invalid configuration detected" on first
   pipeline call. Downloaded to the resolution-correct layout (per the brief's own note:
   "indirme listesi modelin HF repo file listesiyle eşleşmeli").
3. **Decoder file must be `decoder_model_merged_quantized.onnx`, not `decoder_model_quantized.onnx`.**
   transformers.js v3 Seq2Seq forward reads `sessions['decoder_model_merged']`
   (verified in the bundled dist). The brief's example lists the unmerged decoder, which
   would never be loaded and the summarizer would fatal-error offline. Packaged the
   merged decoder (155,102,167 B, verified via HF API).
4. **`env.allowRemoteWasm=false` does not exist in transformers.js v3.8.1** (checked the
   dist + types; setting it is a type error and a no-op). Worse, v3's onnx backend
   SETS `env.backends.onnx.wasm.wasmPaths` to the jsdelivr CDN at import time when
   unset — the extension would fetch WASM remotely. Implemented the v3 equivalent:
   override `wasmPaths` to local `models/ort/` and package the two ORT files. This is
   required for the offline gate to actually hold.
5. **No postinstall/build hook.** The Files line mentioned a hook, but Step 2 only adds
   `fetch:models`. Auto-running a ~330MB download on install is hostile; kept it explicit
   and documented in `public/models/README.md`.
6. **gitignore narrowed** to `public/models/onnx/`, `public/models/ort/`,
   `public/models/tessdata/*.traineddata` instead of blanket `public/models/*` so the
   committed README docs stay trackable.
7. **Network reliability:** the two large HF downloads aborted repeatedly through Node's
   fetch stack ("terminated"); completed via `curl.exe` and byte-verified against the
   HF API. `fetch-models.mjs` handles retries but if the HF CDN resets mid-transfer on a
   CI box, re-running the script resumes (skip-if-exists + retry).

## DoD

- [x] fetch-models.mjs configs, tokenizers & onnx models downloads with retry & parallel
- [x] package.json "fetch:models" script exists
- [x] runtime.ts sets allowRemoteModels=false locally before any pipeline
- [x] dist/models contains tessdata + onnx + configs + tokenizers
- [x] all existing tests pass (32/32)

## Commit

`d67fee6` feat: bundle models for offline use with fetch script
