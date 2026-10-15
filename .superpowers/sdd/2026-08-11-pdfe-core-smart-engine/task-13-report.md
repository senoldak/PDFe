# Task 13 Report — Akıllı Panel: özetleme

## Status: DONE

## Commit
- `063f383` — feat: add local summarization with map-reduce chunking

## Files
- Created: `src/engine/summarize/summarizer.ts` — `Summarizer` class (verbatim from brief)
- Created: `tests/unit/summarizer.test.ts` — 2 tests (verbatim from brief)
- Modified: `src/viewer/smartPanel.ts` — summarize button wiring + new callbacks

## Implementation
1. **`Summarizer`** (`src/engine/summarize/summarizer.ts`), brief verbatim:
   - `MODEL = "Xenova/distilbart-cnn-6-6"` — the model explicitly allowed by the plan's Global Constraints ("özetleme = `Xenova/distilbart-cnn-6-6`"); task-context prose describing "extractive/TF" was inaccurate, the plan + brief both use transformers.js `pipeline("summarization", ...)`.
   - `init()` builds the pipeline; `summarize(text, maxLength=120)` splits via `chunkText` (800 words/chunk), runs map-reduce: each chunk summarized with `max_length = min(maxLength, 200)`, `min_length = 20`, parts joined with a space.
   - Throws "Summarizer not initialized" before `init()`; returns `""` for empty/whitespace text.

2. **`smartPanel.ts`** — per brief Step 3:
   - `SmartPanelCallbacks` gained `summarizer: Summarizer` and `getCorpus: () => DocumentCorpus | null`.
   - `bindSmartPanel` binds `#summarizeBtn` click: `summarizer.summarize(corpus.fullText)` → writes to `#summaryOutput`.

3. **Tests** — `tests/unit/summarizer.test.ts` mocks `@huggingface/transformers`; asserts short-text summary and empty-text behavior.

## Verification
- `npx vitest run tests/unit/summarizer.test.ts` → 2/2 PASS.
- `npm run test` → 12 files / 29 tests PASS.
- `npm run typecheck` → clean.
- `npm run build` → clean (vite + copy-static).

## Deviation from brief (deliberate, minimal)
Brief Step 3 says "add `summarizer: Summarizer`" to `SmartPanelCallbacks` (required). I made it `summarizer?: Summarizer` and `getCorpus?: () => DocumentCorpus | null` (both optional) with a guard (`if (!cb.summarizer || !corpus) return`). Reason: `viewer.ts` and the existing `tests/unit/smartPanel.test.ts` call `bindSmartPanel` without these fields, and the brief's Files list + commit do not include those two files — a required field would break `npm run typecheck` for them. Optional keeps every existing caller compiling while the button is fully functional when the panel is wired with a Summarizer (Task 15 handles model bundling/offline; Task 14 reuses `getCorpus`). No other deviation.

## Self-review
- Completeness: summarizer engine (pure class, map-reduce chunking), summarize tab UI (`#summarizeBtn`, `#summaryOutput` existed from Task 10 scaffold) wired per brief. ✓
- YAGNI: nothing beyond the brief. ✓
- Tests pass, typecheck + build clean. ✓
- No code comments. ✓

## Report file
`C:\DEPO\KOD DEPOSU\PDFe\.superpowers\sdd\2026-08-11-pdfe-core-smart-engine\task-13-report.md`