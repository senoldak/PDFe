# Task 17 Report: Playwright E2E

## Status
DONE

## Commits
- `7252c3b` test: add playwright e2e for extension load and viewer render

## What was done
- Created `playwright.config.ts` — testDir `tests/e2e`, 60s timeout, retries 0, per the brief.
- Created `tests/e2e/extension.spec.ts` — launches a persistent Chromium context with the unpacked `dist/` extension (`--load-extension`, `--disable-extensions-except`, `channel: "chromium"`), resolves the MV3 service worker, extracts the extension ID from its URL, opens `chrome-extension://<id>/viewer.html?file=<fileUrl>`, waits for `.textLayer span` (pdfjs render), and asserts `#pageInfo` = `1 / 1`.
- `package.json` "test:e2e" (`playwright test`) already existed from Task 16 — no change required; verified it runs.

## Verification
- `npm run test:e2e` → **1 passed** (~1–3.5s) in real Chromium (new-headless channel).
- `npm run test` (vitest) → 13 files / 32 tests passed. E2E is excluded from the unit run via `vite.config.ts` test `include: ["tests/unit/**/*.test.ts"]`.
- `npm run typecheck` → clean.
- `npm run build` → succeeds (-vdist rebuilt; static assets copied).
- Playwright version installed: 1.62.1 — its documented extension approach (persistent context + `channel: 'chromium'` + `--load-extension`) matches the brief. Chromium browser was already installed; no `playwright install` needed.

## Notes / deviations from brief
- Brief's corrected fixture snippet used `import pathToFileURL from "node:url"` (default import); used the canonical named import `import { pathToFileURL } from "node:url"` — typechecks and runs identically.
- `--allow-file-access-from-files` added to launch args per the brief's Step-2 note so pdfjs can fetch the local `file://` fixture.
- Service worker lookup uses `serviceWorkers()[0] ?? waitForEvent(...)` per current Playwright docs (handles a worker that already started).
- OCR / summarization / embedding / semantic tests intentionally omitted — the brief scopes E2E to viewer open + render + literal find (OCR/semantic marked out of scope as too heavy for CI).

## Self-review
- Genuine E2E: loads the actual unpacked MV3 extension in real Chromium, boots background service worker, renders the digital fixture in the real viewer (text layer present, pageInfo 1 / 1). Not superficial.
- Hermetic: fixture-driven (`tests/fixtures/digital.pdf`, text-based), works fully offline via `file://`; no network dependence.
- YAGNI: single spec test exactly per brief; nothing beyond it.
- Green: test:e2e, unit, typecheck, build all pass.

## Files
- Created: `playwright.config.ts`, `tests/e2e/extension.spec.ts`
- Modified: none (package.json already had `test:e2e`)