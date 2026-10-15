# Task 8 Report: Akıllı Motor — OCR modülü (Tesseract.js)

## Status
DONE

## What was implemented

### Step 1: `src/engine/ocr/ocr.ts`
Created `OcrEngine` class exactly per the brief:
- `constructor(OcrOptions)` with `langPath`, `corePath`, `workerPath`, `lang`
- `init()` — `createWorker(lang, 1 /* LSTM_ONLY */, { langPath, corePath, workerPath, logger })`; logger maps `status === "recognizing text"` to `progressCb(m.progress)` (progress callback for UI)
- `recognizePage(canvas, pageNumber)` — flattens `data.blocks[].paragraphs[].lines[].words[]` into `TextSpan[]` with `text`, `bbox`, `confidence`; returns `PageText` with `source: "ocr"`; throws `"OcrEngine not initialized"` if called before init
- `setProgress(cb)` and `terminate()`
- All model paths are extension-local (worker/core point at dist-copied files, langPath is `chrome.runtime.getURL(...)` per plan) — fully offline, no CDN/fetch

**API version check:** installed `tesseract.js` is 5.1.1. Verified its `src/index.d.ts` matches the brief verbatim:
- `createWorker(langs?, oem?, options?: Partial<WorkerOptions>, config?)` ✓
- `WorkerOptions` has `corePath`, `langPath`, `workerPath`, `logger` ✓
- `worker.recognize(image, options?, output?: Partial<OutputFormats>)` with `{ text: true, blocks: true }` ✓
- `Page.blocks` (`Block[] | null`), `Block.paragraphs`, `Paragraph.lines`, `Line.words`, `Word.bbox`/`Word.confidence` all exist ✓
No conflict → no coordinator escalation needed.

### Step 2: Build asset copying (offline models)
- `scripts/copy-static.mjs`: added copy of `node_modules/tesseract.js/dist` → `dist/tesseract` and `node_modules/tesseract.js-core` → `dist/tesseract-core` (guarded by `existsSync`)
- `public/manifest.json`: added `"tesseract/*"` and `"tesseract-core/*"` to `web_accessible_resources` so `chrome.runtime.getURL` can serve them

### Step 3: `tests/unit/ocr.test.ts`
Wrote per brief with `vi.mock("tesseract.js")` (no real OCR — deterministic/fast in CI). Two tests: recognize→PageText mapping (source, pageNumber, text, span bbox) and throws-when-not-initialized.

## Verification
- `npx vitest run tests/unit/ocr.test.ts` → 2 passed
- `npm run test` → 7 files, 16 tests passed
- `npm run typecheck` → clean
- `npm run build` → clean; confirmed `dist/tesseract/worker.min.js` + `dist/tesseract-core/tesseract-core-*.wasm` copied, `dist/manifest.json` includes the new WAR entries

## Commit
- `72fba79` feat: add local OCR engine with tesseract.js

## Self-review
- **Completeness:** init/recognize/terminate + progress callback + PageText mapping per shared types all present; offline paths respected.
- **YAGNI:** nothing beyond brief (no extra methods, no comments added).
- **Constraints:** fully offline (no fetch/CDN); commit message matches brief exactly.
- **Concern:** none blocking. (Note: `tesseract-core` also bundles non-wasm `index.js`/`*.wasm.js` copies — harmless extra bytes; matches brief's copy-all approach.)
