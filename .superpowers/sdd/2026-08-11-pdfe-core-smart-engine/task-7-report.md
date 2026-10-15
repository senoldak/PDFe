# Task 7 Report: Akıllı Motor — korpus üretimi

**Status:** DONE

## What Was Done

Implemented the Smart Engine corpus-generation layer, pure TypeScript with no DOM/chrome dependencies:

1. **`src/engine/text/corpus.ts`** — `buildCorpusFromPages(pages)` sorts `PageText[]` by `pageNumber` (non-mutating copy) and produces a `DocumentCorpus` whose `fullText` joins page text with `"\n\n"`. `corpusHasText(corpus)` reports whether `fullText` has non-whitespace content (drives the OCR fallback decision in later tasks).

2. **`src/engine/text/merge.ts`** — `mergeTextAndOcr(textLayer, ocr)` completes the text layer with OCR output: blank text-layer pages are filled from a matching OCR page (spread of the OCR page with `source: "ocr"`); pages with digital text are kept; OCR-only pages (no text-layer counterpart) are appended. Result is sorted by page number.

3. **`tests/unit/corpus.test.ts`** — 4 tests: sort+join, empty-corpus detection, OCR fills blank pages (text + source), and digital text wins when OCR also exists.

## Verification

- `npx vitest run tests/unit/corpus.test.ts` → **PASS** (4/4)
- `npm run test` → **PASS** (6 files, 14 tests)
- `npm run typecheck` → clean
- `npm run build` → clean (dist rebuilt)

## Commit

- `1346053` — `feat: build unified document corpus from text layer and OCR` (3 files, +59)

## Self-Review

- **Completeness:** all three exports implemented exactly per brief; tests match the brief verbatim.
- **YAGNI:** nothing beyond the brief; no comments in code.
- **Concerns:** none. `.superpowers/` remains untracked (not part of this task).
