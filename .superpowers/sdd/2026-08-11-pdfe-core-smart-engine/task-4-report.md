# Task 4 Report — Content script: PDF capture + iframe fallback

**Status:** DONE
**Date:** 2026-08-11

## Summary

Implemented the content script `src/content/contentscript.ts`, the injected style
`src/content/contentstyle.css`, and a unit test for the pure part
(`tests/unit/contentscript.test.ts`). Test, typecheck and build all pass.

## Deliverables

- `src/content/contentscript.ts` — filled the skeleton per the brief:
  - `isPdfUrl` (exported for testing): strips `#fragment` and `?query`, matches `.pdf` (case-insensitive).
  - `detectPdfInDom`: detects `<embed>`/`<object>` with `type=application/pdf` and `<iframe src$='.pdf'>` (case-insensitive `i` modifier).
  - `embedViewer`: injects a fixed full-viewport iframe to `viewer.html?file=<enc>&pdfe=embed` and adds `pdfe-content` to `document.body`.
  - `init`: posts `{ type: "pdfe:detect-pdf", url }` via `window.postMessage(..., "*")` for `.pdf` main-frame URLs not already in `pdfe=embed`; includes the file:// fallback gate (`chrome.extension.isAllowedFileSchemeAccess` / `document.contentType !== "application/pdf"`); embeds the viewer when a PDF is detected in the DOM.
  - `message` listener on `window` for the `viewer:url` ping-pong message (stub per the brief).
- `src/content/contentstyle.css` — `html:has(> body.pdfe-content) { overflow: hidden; }` exactly as specified.
- `tests/unit/contentscript.test.ts` — 2 assertions on `isPdfUrl` exactly as the brief: matches `.pdf`, `.PDF?token=1`, `.pdf#page=3`; rejects `.html`, `.pdfx`.

## Test / typecheck / build

- `npm run test` → **PASS** (3 files, 5 tests; contentscript.test.ts 2/2).
- `npm run typecheck` → clean.
- `npm run build` → clean, error-free.
- Confirmed `dist/contentscript.js` and `dist/contentstyle.css` exist.

## Notes and deviations from the verbatim brief

1. **Comment removed.** The brief's code block contained one line comment
   (`// DNR yoksa ve PDF DOM'da render ediliyorsa iframe ile yakala.`). Global
   constraint "No comments in code" takes precedence, so it was dropped. The
   empty `if` block it annotated is kept structurally as the brief specifies.
2. **Test imports a global shim (vi.hoisted).** vitest runs under `environment: "node"`
   (no jsdom installed), and importing `contentscript.ts` evaluates top-level
   `init()` → `window.location.href`, which throws ReferenceError without a
   `window`/`document`/`chrome` global. Added a `vi.hoisted` shim (same pattern as
   `tests/unit/background.test.ts`) so only the pure `isPdfUrl` logic is exercised;
   the brief itself acknowledged the DOM load side effect cannot be tested without
   jsdom. This was required to reach the brief's "Expected: PASS".
3. **`chrome.extension.isAllowedFileSchemeAccess` is used as a truthiness check.**
   @types/chrome declares it as a callback/Promise API, so it is always truthy and
   the inner `if` condition effectively reduces to `document.contentType !== "application/pdf"`.
   The inner block is empty (a stub) exactly as the brief specifies — the actual
   iframe-capture fallback logic appears to be a follow-up task. Flagging for the
   task that inherits this.
4. **Build output filename.** The manifest already registers the content script as
   `js: ["contentscript.js"]` / `css: ["contentstyle.css"]`, which match Vite's
   `[name].js` output at `dist/` root. The task-prompt's "lib/content.js" does not
   apply to this repo's vite config; **no manifest change was needed**.
5. **`dist/contentscript.js` is a classic script.** Rollup tree-shook the `export`
   (nothing imports it), so the emitted content script contains no `import`/`export`
   statements — valid for MV3 content scripts.
6. Cosmetic: git reported LF→CRLF normalization warnings on add (`.gitattributes`
   / core.autocrlf not configured); no content impact.

## Commit

- `15ddb3c` — `feat: content script PDF detection with iframe fallback`
  (`src/content/contentscript.ts`, `src/content/contentstyle.css`, `tests/unit/contentscript.test.ts`)