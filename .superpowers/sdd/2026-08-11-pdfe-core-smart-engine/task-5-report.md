# Task 5 Report — Viewer çekirdeği (pdfjs-dist yükleme + render + text layer)

**Status:** DONE_WITH_CONCERNS

## Summary
Implemented the viewer core per `task-5-brief.md`:
- `src/viewer/pdfLoader.ts` — `GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.mjs")` (worker copied verbatim to `dist/pdf.worker.mjs` by Task 3's `copy-static.mjs`) + `loadDocument(url)` via `getDocument({ url })`.
- `src/viewer/pageRenderer.ts` — `renderPage(page, canvas, container, scale)`: DPR-aware canvas sizing, `page.render()` with transform, real `new TextLayer({ textContentSource, container, viewport }).render()`, and mapping of `textContent.items` → `TextSpan[]` (text only; bbox/confidence left `undefined` for Team 11).
- `src/viewer/viewer.css` — layout + text layer styles (verbatim from brief).
- `src/viewer/viewer.ts` — `?file=` param parsing, toolbar/pages scaffold, load doc, render all pages at scale 1.25, `page.cleanup()`.
- `tests/unit/pageRenderer.test.ts` — passes.
- `vite.config.ts` — `test.environment: "jsdom"`.

## Verification
- `npx vitest run` → 4 files, 6 tests PASS (incl. new pageRenderer test; existing background/contentscript/types tests still pass under jsdom).
- `npm run typecheck` → clean.
- `npm run build` → clean; viewer.js bundles pdfjs-dist; `pdf.worker.mjs` copied to dist.

## Commits
- `939e986` `feat: render PDF pages with pdfjs-dist and text layer`

## Deviations from the brief (required to satisfy Step 6/7 pass criteria)
1. **jsdom has no 2D canvas context.** The brief's literal test mock crashed the *real* TextLayer path: `canvas.getContext("2d")` returns `null` in jsdom → `WeakMap` "invalid key" → `render()` promise rejected → timeout. Fixed inside the test file with a minimal `HTMLCanvasElement.prototype.getContext` shim (`measureText`/`font`/`canvas` only). Production code untouched.
2. **Brief's mock `TextContent` was incomplete for pdf.js 4.10's real TextLayer.** `TextLayer.#appendText` reads `item.fontName` → `styles[fontName]`; with no `styles`, render rejected. The mock now returns the faithful shape (`styles: { f1: {...} }`, items carry `fontName`, `dir`, `hasEOL`, `type: "text"`). Production code untouched.
3. **`transform: ... : null` does not typecheck** against pdfjs-dist 4.10 types (`transform?: any[] | undefined`). Changed `null` → `undefined` (runtime-identical, both falsy). One-char semantic-equivalent deviation from the brief's literal code.
4. **`import "./viewer.css"` fails `tsc`** without Vite's ambient CSS declaration → added `src/vite-env.d.ts` (`/// <reference types="vite/client" />`), standard Vite practice.

## Notes / concerns
- The brief's "Interfaces" section lists `getPageText(page, viewport)` as a produced interface, but no step in the brief implements it and no later step in this task consumes it (corpus assembly is Task 7). Per YAGNI it was **not** added; flagging so the coordinator decides whether a follow-up needs it.
- Real-browser worker behavior (`chrome.runtime.getURL("pdf.worker.mjs")` under the MV3 CSP `script-src 'self' 'wasm-unsafe-eval'`) cannot be verified headlessly; config matches the brief and Task 3 already provisions the worker asset.
- `npm audit` reports vulnerabilities (3 moderate / 3 high / 1 critical) in the dependency tree; `npm audit fix --force` would introduce breaking changes, so nothing was force-fixed. Pre-existing/transitive, not introduced by this task's additions.

## Files
- Created: `src/viewer/pdfLoader.ts`, `src/viewer/pageRenderer.ts`, `src/viewer/viewer.css`, `src/vite-env.d.ts`, `tests/unit/pageRenderer.test.ts`
- Modified: `src/viewer/viewer.ts`, `vite.config.ts`, `package.json`, `package-lock.json`
