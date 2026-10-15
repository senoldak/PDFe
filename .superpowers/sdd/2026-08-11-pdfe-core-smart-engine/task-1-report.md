# Task 1 Report — Proje iskeleti + build altyapısı

**Status:** DONE_WITH_CONCERNS
**Commit:** `fa7e7be` — `feat: scaffold Manifest V3 extension with Vite multi-entry build`
**Date:** 2026-08-11

## What I implemented

Full project scaffold + build infrastructure for the PDFE Manifest V3 extension:

- `package.json` — scripts (`build`/`dev`/`test`/`test:e2e`/`typecheck`), dev deps (vite 6, vitest, typescript, @types/chrome, playwright) and runtime deps (pdfjs-dist, tesseract.js, @huggingface/transformers) — verbatim from brief.
- `tsconfig.json` — strict, bundler resolution, DOM+WebWorker libs — verbatim.
- `vite.config.ts` — manual multi-entry (viewer.html, background, contentscript, contentstyle) — verbatim except one import fix (see concern 4).
- `scripts/copy-static.mjs` — copies manifest/icons/models to `dist/`, copies `pdf.worker.mjs` — plus output relocation (see concern 3).
- `scripts/make-icons.mjs` — dependency-free PNG generator — plus a validity fix (see concern 2).
- `public/manifest.json` — minimal MV3 manifest (see concern 1).
- `public/icons/icon16.png`, `icon48.png`, `icon128.png` — 16/48/128px solid-color PNGs.
- `.gitignore` — `node_modules/`, `dist/`, `test-results/`, `playwright-report/` — verbatim.
- `public/models/README.md` — placeholder describing the model layout (see concern 6).
- Skeleton sources: `src/background/background.ts` (`export {}`), `src/content/contentscript.ts` (`export {}`), `src/content/contentstyle.css` (empty, see concern 5), `src/viewer/viewer.html`, `src/viewer/viewer.ts` — verbatim from brief.

## Build results

- `npm install` — OK, 131 packages (audit/fund skipped), ~6 min.
- `npm run build` — OK, no errors/warnings beyond Vite's expected "Generated an empty chunk" notices for the skeleton `background`/`contentscript` entries.
- `npm run typecheck` — OK (see concern 4).
- Icons verified as valid PNGs two ways: Windows GDI+ decodes at 16/48/128 and Node `zlib.inflateSync` decompresses the IDAT to the exact expected scanline size (`s*(s*3+1)`).

Final `dist/` (exactly the brief's Step 8 expected outputs, verified after a from-scratch clean rebuild):

```
dist/manifest.json        dist/background.js(+.map)   dist/contentscript.js(+.map)
dist/viewer.html          dist/viewer.js(+.map)       dist/contentstyle.css
dist/pdf.worker.mjs       dist/icons/icon{16,48,128}.png   dist/models/README.md
```

## Files changed

17 files committed in `fa7e7be` (see commit for full list). Notable: `package-lock.json` included; `.superpowers/` intentionally left untracked (see concern 7).

## Self-review findings

- **Completeness:** Every file in the brief's Files list exists and is wired into the build; the build reproduces byte-identical output on a clean rebuild.
- **Quality:** copy-static output naming matches the manifest contract that Task 3 hardcodes (`viewer.html`, `contentstyle.css` at extension root).
- **Discipline (YAGNI):** nothing beyond the brief was added except the minimal fixes required to meet the brief's own acceptance criteria; no comments added; no unused deps.
- **Testing:** `npm run build` and `npm run typecheck` both pass cleanly; outputs verified file-by-file.

## Concerns / deviations from the brief

1. **`public/manifest.json` content was missing from the brief** (also missing from the plan). Per the task note, the full manifest (permissions, host_permissions, background SW, content scripts, web_accessible_resources) is a Task 3 deliverable. I derived this task's minimal manifest from Task 3's full manifest by removing exactly those Task 3 additions and keeping the global constraints verbatim: MV3, `minimum_chrome_version: "128"`, the CSP `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`, `icons`, plus name/version/description/action. Task 3 will overwrite it wholesale.
2. **`make-icons.mjs` produced invalid PNGs as written in the brief.** The `png()` function wrote raw scanlines directly into IDAT with no zlib header/footer — Node `zlib.inflateSync` rejects it (`unknown compression method`); GDI+ only tolerated it. Chrome's strict decoder would reject these icons, defeating the stated purpose ("geçerli PNG — Playwright yükleme testinde kullanılır"). I wrapped the IDAT in a valid stored zlib block (header `0x78 0x01`, BFINAL stored block, Adler-32) — still dependency-free. Also fixed a signed 32-bit overflow in the Adler-32 write (`>>> 0`). The brief's note about an unused `raw` variable did not apply (no such variable exists in the given code).
3. **`vite.config.ts` verbatim produced the wrong output paths.** Vite emits the HTML entry at `dist/src/viewer/viewer.html` (path preserved) and emits the `.css` rollup entry as `contentstyle.js` (a JS injector). Neither matches the brief's expected outputs or Task 3's manifest contract. I kept `vite.config.ts` verbatim and instead fixed the outputs in the post-build `copy-static.mjs`: relocate `dist/src/viewer/viewer.html` → `dist/viewer.html`, remove `contentstyle.js`/`.map`, copy `src/content/contentstyle.css` → `dist/contentstyle.css`.
4. **Typecheck fails with the brief's verbatim config.** `import { defineConfig } from "vite"` rejects the `test` field (`Property 'test' does not exist in type 'UserConfigExport'`). Changed the import to `vitest/config` (one line) so `npm run typecheck` passes — later tasks gate on it. Build behavior is identical.
5. **`src/content/contentstyle.css` created (empty)** — not in the brief's file list, but it is a declared rollup input and a required output (`dist/contentstyle.css`). The plan's Task 4 wording ("mevcut boş dosyayı doldur") confirms it should already exist empty.
6. **`public/models/README.md` content unspecified** in the brief/plan. Wrote a minimal Turkish README documenting that models are bundled locally and listing the `tessdata/` (OCR) and `onnx/` (embedding/summarization) layout.
7. **Commit scope:** used the brief's exact message but staged only the scaffold files (not `.superpowers/`), consistent with repo history where `.superpowers/` was never committed; `git add -A` from the brief would have swept in the untracked SDD workflow directory.

No blocking concerns — all deviations are minimal, evidence-based fixes to defects in the brief's own code, documented above. The scaffold builds cleanly and satisfies the brief's Step 8 acceptance criteria.
