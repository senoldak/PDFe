# Task 11 Report: Akıllı Motor — pipeline orkestrasyonu

## Status: DONE

## Summary
Implemented `src/engine/pipeline.ts` (EnginePipeline) exactly as specified in the brief, verified against the actual interfaces of the four consumed modules, plus tests in `tests/unit/pipeline.test.ts`.

## Verification of consumed interfaces (before writing)
Read all four module sources:
- `src/engine/text/corpus.ts` — `buildCorpusFromPages(pages: PageText[]): DocumentCorpus`, `corpusHasText(corpus): boolean` — match brief.
- `src/engine/text/merge.ts` — `mergeTextAndOcr(textLayer, ocr): PageText[]` — fills only blank text-layer pages with OCR, keeps digital text. Match.
- `src/engine/ocr/ocr.ts` — `OcrEngine` with `init()`, `recognizePage(canvas, pageNumber): Promise<PageText>`, `terminate()`, `setProgress(cb)`. Match.
- `src/engine/search/semantic.ts` — `SemanticSearch` with `init()`, `index(corpus)`, `search(query, topK=5): Promise<SearchResult[]>`. Match.

No conflicts — brief code used verbatim.

## What was built
`class EnginePipeline`:
- `setState(cb)` registers the `EngineState` callback.
- `emit(partial)` merges partial state over the idle defaults and fires the callback.
- `run(pages, { scale })`:
  1. Extracts text-layer `PageText[]` from `page.getTextContent()` (filters non-string/blank items).
  2. Builds preliminary corpus via `buildCorpusFromPages`.
  3. Decision rule (per brief): if `!corpusHasText(preliminary)` → OCR path: emit `ocr: loading` (progress 0.05), `ocr.init()`, render each page to canvas at `opts.scale`, `ocr.recognizePage`, emit `ocr: running` with per-page progress `(i+1)/pages.length`, `ocr.terminate()`, then `mergeTextAndOcr` to fill blank pages.
  4. Builds final corpus, stores it, emits `ocr: done`, progress 1, `corpusReady: true`.
  5. If `corpusHasText(corpus)`: `semantic.init()` + `semantic.index(corpus)`, emits `searchReady: true`.
  6. Returns `DocumentCorpus`.
- `search(query)`: returns `[]` if no corpus built yet, else delegates to `semantic.search`.

## EngineState transitions emitted
- `{ocr: idle, ocrProgress: 0, corpusReady: false, searchReady: false}` (start)
- → `{ocr: loading, ocrProgress: 0.05}` (OCR start)
- → `{ocr: running, ocrProgress: i+1/n}` per page
- → `{ocr: done, ocrProgress: 1, corpusReady: true}` (corpus built)
- → `{searchReady: true}` (index complete)
- Digital-text path skips OCR and goes idle(0) → done(1)/corpusReady → searchReady.

## Tests
`tests/unit/pipeline.test.ts` from the brief (2 tests):
1. "builds corpus from digital text without OCR" — PASS (`ocr.init` not called, fullText contains "merhaba", corpusReady emitted).
2. "falls back to OCR when text is empty" — PASS (`ocr.init` called, fullText contains "ocr1").

Full suite: `npx vitest run` → 10 files / 23 tests, all PASS.
`npm run typecheck` → clean.
`npm run build` → clean (vite + static copy).

## Commit
`35a19d0` feat: orchestrate OCR, corpus and semantic index in pipeline
(staged exactly `src/engine/pipeline.ts` and `tests/unit/pipeline.test.ts`; `.superpowers/` left untracked as prior tasks)

## Self-review
- Completeness: run() covers textLayer→corpus→OCR-fill→embed→index; search(); setState/emit present. ✓
- State transitions cover idle→loading→running→done plus corpusReady and searchReady, with ocrProgress 0..1. ✓
- YAGNI: nothing beyond the brief (no extra features, no comments). ✓
- Tests pass; typecheck + build clean. ✓

## Concerns (non-blocking)
1. jsdom emits `Not implemented: HTMLCanvasElement's getContext()` on the OCR branch. Non-fatal (render mock ignores ctx; both tests pass), and expected per the brief's note that jsdom provides `document.createElement`. Real browser canvas works. Could be silenced later with a `canvas` dev-dependency or a ctx stub in the test.
2. Decision rule is global: OCR runs only when the *whole* preliminary corpus has no text. The Task 8 review note says `mergeTextAndOcr` fills only blank pages and the pipeline decides when OCR runs; the brief's rule (`!corpusHasText(preliminary)`) means a doc with any digital text will leave truly blank pages unfilled. This matches the brief verbatim and was implemented as specified; flagging only because the plan language hinted at "or to fill blanks". Task 12 UI wiring can revisit if desired.

## Report file
`C:\DEPO\KOD DEPOSU\PDFe\.superpowers\sdd\2026-08-11-pdfe-core-smart-engine\task-11-report.md`
