# Task 6 Report — Viewer UI (toolbar, navigation, zoom, literal search)

**Status:** DONE_WITH_CONCERNS

## Summary

Implemented the interactive viewer UI per the brief:

- `src/viewer/toolbar.ts` — `createToolbar(cb)` renders `#toolbar` with prev/next, zoom in/out, find input (input + prev/next), and smart-panel toggle buttons wired to `onNavigate`/`onZoom`/`onFind`/`onToggleSmartPanel`; plus `updatePageInfo(el, current, total)`. Verbatim from brief Step 1.
- `src/viewer/findBar.ts` — pure `findInSpans(spans, query, regex?)` doing literal (escaped) or regex case-insensitive search over page spans, returning `FindResult[]` with `pageNumber`/`spanIndex`/`text`; empty on empty query, [] on invalid regex. Verbatim from brief Step 2.
- `src/viewer/viewer.ts` — reworked to module-level `renderedPages`/`currentPage`/`scale`/`pdf` state; `renderAll()` re-renders all pages at current scale and updates page info; `scrollToPage(n)` navigates; `init()` appends toolbar + `#pages`, loads the doc, wires find via `findInSpans(renderedPages.flatMap(...))`. Visual highlighting (`.find-result`) intentionally deferred to Task 10 per brief note.
- `tests/unit/findBar.test.ts` — all 4 tests from the brief (literal case-insensitive, regex flag, empty query, invalid regex).

## Verification

- `npx vitest run tests/unit/findBar.test.ts` → 4 passed.
- `npm run test` → 5 files, 10 tests passed.
- `npm run typecheck` → clean.
- `npm run build` → clean, viewer.js 368 kB, static assets copied.

## Commit

- `da05da6` `feat: add viewer toolbar, navigation, zoom and literal search`

## Concerns / Deviations (require reviewer attention)

1. **`#title` null deref in brief's Step 3 viewer.ts.** The new `createToolbar()` (Step 1, verbatim) no longer renders a `#title` element, but the verbatim Step 3 viewer.ts did `document.getElementById("title")!.textContent = ...` which throws `TypeError` at runtime (and `?.` on an assignment target is a TS/esbuild error). I changed it to `const title = document.getElementById("title"); if (title) title.textContent = ...`. Minimal safe guard; revert to verbatim only if `#title` is guaranteed to exist (it isn't today). A later task may reintroduce a title element (e.g. Task 10).
2. **Test file name mismatch in the brief.** "Files" lists `tests/unit/toolbar.test.ts`, but Step 4's code and Step 6's commit both reference `tests/unit/findBar.test.ts`. I created `findBar.test.ts` (matching the verbatim test code + commit).
3. **`createFindBar({ onFind })` in the "Produces" section is not implemented** — the brief's only verbatim find code is `findInSpans`, and viewer.ts wires `onFind` through it. Visual layer (`.find-result` on text spans) is documented as Task 10.
4. **`src/viewer/viewer.css` listed as modified but the brief provides no CSS content.** Left unchanged; existing toolbar/page styling covers the new buttons. No CSS was invented to stay within the brief.
5. **Unused `results` in `onFind`** is intentionally verbatim from the brief; highlighting lands in Task 10.

## Self-Review Checklist

- Toolbar with navigation/zoom/find callbacks: yes, verbatim.
- Find bar regex/literal search: yes, pure + tested.
- viewer.ts wiring: yes (+ one guard, see concern 1).
- Tests pass, typecheck + build clean: confirmed.
- Nothing beyond the brief.