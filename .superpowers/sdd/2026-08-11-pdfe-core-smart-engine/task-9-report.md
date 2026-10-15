# Task 9 Report — Akıllı Motor: anlamsal arama (transformers.js embedding)

## Status: DONE_WITH_CONCERNS

## Commit
- `5a186d7` — feat: add local semantic search with transformers.js embeddings

## Files
- Created: `src/engine/search/semantic.ts` — `SemanticSearch` class
- Created: `tests/unit/semantic.test.ts` — 2 tests

## Implementation
`SemanticSearch` implements the specified contract:
- `init(): Promise<void>` — builds the feature-extraction pipeline via `pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" })`.
- `index(corpus: DocumentCorpus): Promise<void>` — sentence-level chunking: each non-empty `page.spans[i].text` becomes an indexed sentence (batch: 64/chunk), embedded with `pooling: "mean", normalize: true`.
- `search(query, topK = 5): Promise<SearchResult[]>` — cosine similarity against the index, descending sort, top-K slice; each result is `{ pageNumber, spanIndex, span: { text }, score, kind: "semantic" }` per `SearchResult` (Task 2). Throws "not initialized" before `init()`; returns `[]` for an empty index.

## Tests
`npx vitest run tests/unit/semantic.test.ts` → 2/2 PASS. Full `npm run test` → 8 files / 18 tests PASS. `npm run typecheck` clean, `npm run build` clean.

## Deviation from the brief (necessary)
The brief's verbatim code declares `private index: IndexedSentence[]` and a method `index(corpus)`. In JS/TS the field's initializer shadows the prototype method, so `s.index` was the array, not a function → "s.index is not a function", the brief's own test failed. Minimal fix: renamed the private field to `indexed` (all 3 usages). The public API (`init`/`index`/`search`) is unchanged.

## Offline constraint — concern (deferred, by design)
`MODEL = "Xenova/all-MiniLM-L6-v2"` is a model **ID**, not a remote URL. Verified in the installed `@huggingface/transformers` 3.8.1: a valid HF model ID resolves to `env.localModelPath + modelId` first, and `env.allowRemoteModels = false` blocks the HF CDN fallback. The brief does not include env wiring and its test mocks only `pipeline` (importing `env` in this module would break that test), so full offline guarantees require the caller (engine-worker glue, Task 11/15) to set `env.allowRemoteModels = false` + `env.localModelPath = chrome.runtime.getURL("models/")`. Model files for `Xenova/all-MiniLM-L6-v2` are not yet present under `public/models/` — `copy-static.mjs` already copies `public/models` → `dist/models`, so bundling those files is still open (matches Task 8 ledger NOTE).

## Self-review
- Completeness: init / index (sentence chunking + embedding) / search (cosine + topK, SearchResult with spanIndex) — done.
- Offline: model is an ID resolved locally via `env.localModelPath` (wiring is caller's job; see concern).
- YAGNI: nothing beyond the brief.
- Tests pass, typecheck + build clean.