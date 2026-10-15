# Task 14 Report: Akıllı Panel — veri çıkarma (Smart Panel — data extraction)

**Status:** DONE_WITH_CONCERNS

## Summary

Implemented template/rule-based structured data extraction from the document corpus,
fully offline. Filled the Smart Panel's `#tab-extract` section with an "Verileri Çıkar"
button that runs the extractor on the corpus and renders the result as a label/value
table.

## Files

- Created `src/engine/extract/extract.ts` — pure `extractFields(corpus, schema)`:
  runs each schema field regex (`gi`) over `corpus.fullText`, returns first match or `null`.
- Created `src/engine/extract/schemas.ts` — `INVOICE_SCHEMA` (faturaNo, tarih, tutar,
  kdv, iban, tedarikci) and `GENERAL_SCHEMA` (email, telefon, tcNo, tarih).
- Modified `src/viewer/smartPanel.ts` — imported `extractFields` + `INVOICE_SCHEMA`,
  wired `#extractBtn` click to call `extractFields(cb.getCorpus()!, INVOICE_SCHEMA)` and
  render the result as a `<table>` into `#extractOutput`.
- Created `tests/unit/extract.test.ts` — the 3 tests verbatim from the brief.

## Deviation from brief (concern)

The brief's schema regexes for `tutar` and `tedarikci` are internally inconsistent —
they do NOT satisfy the brief's own test assertions. Verified empirically:

- `tutar` pattern `(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2})\s?(?:TL|₺|TRY)?\b`
  first-match on the test text is `"15.03"` (the date fragment from `15.03.2026`),
  so `expect(r.tutar).toBe("1.250,00 TL")` fails.
- `tedarikci` pattern `\b[A-Z][^\n,;]{5,60}\b` (case-insensitive `i` flag)
  first-match is `"FATURA No: 2026/0001"`, so `expect(r.tedarikci).toBe("Acme Ltd")` fails.

Minimal fixes applied only to `src/engine/extract/schemas.ts` (tests kept verbatim):

- `tutar`: `(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2}(?![\d.]))\s?(?:TL|₺|TRY)?\b` —
  negative lookahead stops the `\d+\.\d{2}` alternative from matching date fragments.
  Verified: `["1.250,00 TL"]` is the sole match.
- `tedarikci`: `(?<=Tedarikçi\s*:\s*)[A-Z][^\n,;]{2,60}` —
  label-anchored lookbehind extracts the supplier name after "Tedarikçi:".
  Verified: `"Acme Ltd"`.

All other patterns match the brief verbatim.

## Verification

- `npx vitest run tests/unit/extract.test.ts` → 3/3 PASS
- `npx vitest run` → 32/32 PASS across 13 suites (including existing smartPanel suite)
- `npm run typecheck` → clean
- `npm run build` → clean (chunk-size warning pre-existing, unrelated to this task)

## Commit

- `b6ae53a` feat: add template-based data extraction for invoices and general fields

## Self-review

- **Completeness:** pure, tested `extractFields`; both schemas; extract tab button wired
  to render a key/value table; `getCorpus` callback reused (already present from Task 13).
- **YAGNI:** nothing beyond the brief — no extra fields, no UI chrome, no new deps.
- **Tests/build:** ALL green as above.