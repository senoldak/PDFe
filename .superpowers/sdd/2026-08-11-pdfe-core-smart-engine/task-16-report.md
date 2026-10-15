# Task 16 Report — README, gizlilik politikası, örnek PDF'ler

**Status:** DONE

**Commit:** `28f6b67` — `docs: add README, license, privacy policy and test fixtures`

## Done

- **`README.md`** — vision, features, install (`npm install` / `npm run fetch:models` / `npm run build`), load-unpacked instructions, test commands, privacy section cross-linking `docs/PRIVACY.md`, license section cross-linking `LICENSE` + `docs/MODEL_LICENSES.md`.
- **`docs/PRIVACY.md`** — brief's Turkish privacy statement (no server sends, no analytics/cookies, bundled offline models, no data collection) plus honest technical notes: `chrome-extension://` URLs + MV3 message passing stay in-browser, no runtime network fetches, data scope limited to PDFs in active tabs.
- **`LICENSE`** — Apache 2.0 full text downloaded from `https://www.apache.org/licenses/LICENSE-2.0.txt` (11,358 bytes).
- **`NOTICE`** — brief's exact text (PDFE, copyright 2026, Apache 2.0, third-party pointers).
- **`scripts/make-fixtures.mjs`** — generates the two fixtures via minimal hand-written PDF bytes.
- **`tests/fixtures/digital.pdf`** + **`tests/fixtures/scanned.pdf`** — committed as small binary files (per-brief option).
- **`public/models/.gitignore`** (`*` / `!README.md`) — root `.gitignore` ignores it via its own `*` rule, so committed with `git add -f` as the brief requires.

## Verification

- `node scripts/make-fixtures.mjs` → fixtures written.
- pdfjs-dist live check: `digital.pdf` → 1 text item `"Vergi dairesi FATURA No 2026/0001 Tarih 15.03.2026 Tutar 1.250,00 TL"`; `scanned.pdf` → 0 items (OCR path trigger).
- `npm run typecheck` — clean. `npm test` — 13 files / 32 tests passed. `npm run build` — clean (only pre-existing large-chunk size warnings).

## Deviation from brief (intentional, documented)

The brief's `minimalPdf` template base64-encoded the content stream (`Buffer.from(content).toString("base64")`). Verified against pdfjs-dist: that makes the stream an unknown command (`VmVyZ2kg...`), so **`digital.pdf` returned 0 text items** — defeating the fixture's stated purpose ("text layer dolu"). Fixed minimally: content stream is now raw PDF operators with `/F1 12 Tf` + `(text) Tj`, so `digital.pdf` has a real readable text layer and `scanned.pdf` keeps an empty one (`BT\nET`). All brief text values ("Vergi dairesi FATURA No 2026/0001 ...", etc.) and the scanned behavior are unchanged.

## Concerns

None blocking. No existing e2e test consumes the fixtures yet (unit suite doesn't touch them); they're ready for Task 17's e2e tests as planned.
