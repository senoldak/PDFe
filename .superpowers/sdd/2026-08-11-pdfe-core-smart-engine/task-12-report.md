# Task 12 Report: Akıllı Panel — OCR durumu + anlamsal arama UI

## Status: DONE

## Commit
`ea4d4df` feat: bind smart panel to pipeline with OCR status and semantic search
(staged exactly `src/viewer` + `tests/unit/smartPanel.test.ts` per brief; `.superpowers/` left untracked as in prior tasks)

## Verification of consumed interfaces (before writing)
- `src/viewer/smartPanel.ts` — Task 10 scaffold had only `createSmartPanel()` with empty sections; brief code fills `#tab-ocr` (`#ocrStatus`, `#ocrProgressWrap`/`#ocrProgress`), `#tab-search` (`#semanticInput`, `#searchResults`), plus inert summary/extract placeholders.
- `src/viewer/highlight.ts` — `highlightSpans(containers, refs)` + `searchResultsToRefs`; used only from the existing literal `onFind` path. The panel result-click interface in the brief navigates via `onHighlight(pageNumber)` (no span-highlight on click was briefed).
- `src/viewer/viewer.ts` — owns `scrollToPage`, `renderedLayers`; pipeline was **not** previously instantiated — wired it now.
- `src/engine/pipeline.ts` — `EnginePipeline.setState(cb)` + `run(pages, { scale })` + `search(q)`; `PipelineDeps` requires `ocr`, `semantic`, plus unused `ocrLangPath/ocrCorePath/ocrWorkerPath` fields (must be supplied).
- `src/shared/types.ts` — `EngineState { ocr: idle|loading|running|done|failed, ocrProgress 0..1, corpusReady, searchReady }`, `SearchResult { pageNumber, spanIndex, span, score, kind }`. All match the brief verbatim.

## What was built
**`src/viewer/smartPanel.ts`** — functional per brief:
- `createSmartPanel()` now renders OCR status area, semantic search input + results list, and summary/extract placeholder buttons (filled in Tasks 13/14).
- `bindSmartPanel(panel, { pipeline, onHighlight })` → `{ setState(s) }`:
  - `setState` maps `s.ocr` → Turkish status text (Hazır / yükleniyor / çalışıyor / tamamlandı / başarısız), shows `#ocrProgressWrap` only while `running`, writes `s.ocrProgress` into the `<progress>`.
  - 300 ms debounced `input` listener on `#semanticInput` → `pipeline.search(q)` → `renderResults`; each `<li>` shows `"{page}. sayfa — {span.text.slice(0,60)}"` and calls `cb.onHighlight(pageNumber)` on click.

**`src/viewer/viewer.ts`** — wiring:
- Creates `EnginePipeline` with `OcrEngine` (`chrome.runtime.getURL("tesseract/")`, `"tesseract-core/"`, `"tesseract/tesseract.min.js"`, `lang: "tur"`) and `SemanticSearch`; `ocrLangPath/ocrCorePath/ocrWorkerPath` supplied to satisfy `PipelineDeps` (these fields are accepted but unused by `run()` today).
- `bindSmartPanel(panel, { pipeline, onHighlight: (n) => scrollToPage(n) })`.
- `pipeline.setState((s) => panelApi.setState(s))` so every EngineState emit renders live in the panel (idle/loading/running/done + progress).
- After `renderAll()`, fetches fresh page proxies via `pdf.getPage(i)` loop and `await pipeline.run(pageProxies, { scale })` (fresh proxies needed because `renderAll` cleans up its own).

**`src/viewer/viewer.css`** — unchanged. Task 10 already ships `#smartPanel`, nav, section, and `progress` styling; the brief's Step 1 markup is fully functional with it and no CSS block was provided to add.

**`tests/unit/smartPanel.test.ts`** — 2 tests from the brief (renders "OCR çalışıyor…" on running state; progress wrap hidden once done).

## One required type fix (same as Task 10)
The brief's verbatim test line `panel.querySelector("#ocrProgressWrap")!.hidden` fails `tsc --noEmit` — `Element` has no `hidden` in the DOM lib. Changed to `panel.querySelector<HTMLElement>("#ocrProgressWrap")!`. Behavior identical; mirrors the equivalent fix Task 10 applied in `smartPanel.ts`.

## Verification
- `npx vitest run tests/unit/smartPanel.test.ts` → 2/2 PASS.
- `npm run test` → 11 files / 25 tests PASS (smartPanel 2 included).
- `npm run typecheck` → clean.
- `npm run build` → clean (vite + static copy; only the known >500 kB chunk warnings due to bundled wasm/embedders).

## Self-review
- Completeness: EngineState-driven OCR renderer ✓; search input + results list with debounce ✓; result-click → `onHighlight(pageNumber)` → `scrollToPage` ✓; panel wired into viewer with pipeline ✓.
- YAGNI: nothing beyond the brief — no summit/extract logic (Tasks 13/14), no click-to-span highlight beyond the briefed navigate-only interface, no comments. ✓
- Tests / typecheck / build all green. ✓

## Concerns (non-blocking)
1. `viewer.css` appears in the brief's Files list but no CSS block exists in Steps 1–5; existing Task 10 CSS already renders the panel correctly, so no change was made. If a specific style is expected, it wasn't specified.
2. `PipelineDeps.ocrLangPath/ocrCorePath/ocrWorkerPath` are required-by-interface but unused inside `run()` (Task 11 note). Supplying `chrome.runtime.getURL(...)` values keeps the contract; if the pipeline later wires OCR options from deps, no viewer change needed.
3. `OcrEngine.lang` set to `"tur"` (brief didn't specify; app copy is Turkish). Tesseract's `tur` traineddata must exist under the langPath for OCR to actually run — asset layout assumes `tesseract/` is copied by `scripts/copy-static.mjs`.
4. Semantic result click navigates but does not flash-highlight the spans (`highlightSpans` still wired only to the literal find bar, per brief).

## Report file
`C:\DEPO\KOD DEPOSU\PDFe\.superpowers\sdd\2026-08-11-pdfe-core-smart-engine\task-12-report.md`