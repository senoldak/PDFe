# Task 3 Report — Background service worker + DNR yönlendirme

## Status: DONE_WITH_CONCERNS

## Commits
- `5abd145` feat: register DNR rules to redirect PDFs to the viewer

## Changes
- `public/manifest.json` — full MV3 manifest verbatim from brief: permissions (`declarativeNetRequestWithHostAccess`, `tabs`, `webNavigation`, `storage`), `<all_urls>` host perms, background service worker (`background.js`, module), content scripts, CSP, icons, web_accessible_resources.
- `src/background/background.ts` — replaced scaffold. Per brief: `export function getViewerUrl(pdfUrl: string, baseUrl = VIEWER_URL)`, `registerRedirectRule()` (id-1 allow rule, id-2/3 redirect rules with responseHeaders conditions, `addRules as any` cast), onInstalled/onStartup registration, file:// onBeforeNavigate fallback, viewer:get-url message hub. Code matches the brief verbatim.
- `tests/unit/background.test.ts` — both getViewerUrl tests pass (`npm run test`: 2 passed; full suite 3 passed).

## Verification
- `npx vitest run tests/unit/background.test.ts` — PASS (2 tests)
- `npm run typecheck` — clean
- `npm run build` — clean; `dist/manifest.json` contains all permissions + `"background": { "service_worker": "background.js", "type": "module" }` (verified grep on dist output)

## Concerns / Deviations from brief text
1. **Test calls with explicit baseUrl, not the brief's literal code block.** The brief's Step 3 note (line 187) and the task instructions mandate `getViewerUrl(pdfUrl, baseUrl = chrome.runtime.getURL("viewer.html"))` tested by passing the second argument. The brief's code block itself calls without baseUrl, which is impossible to pass as written (chrome absent in node test env). I followed the note/task description, not the literal code block. This was already a known plan self-review fix.
2. **Minimal `chrome` stub added inside the test file via `vi.hoisted`.** The brief's stated premise was that passing an explicit baseUrl removes the chrome dependency. That premise is incomplete: `background.ts` also evaluates `const VIEWER_URL = chrome.runtime.getURL("viewer.html")` and registers `onInstalled`/`onStartup`/`onBeforeNavigate`/`onMessage` listeners at module scope, so importing the module under node throws `ReferenceError: chrome is not defined`. Fix kept entirely within the test file (a `vi.hoisted` global stub that runs before imports, documented Vitest behavior). No production code or config beyond the brief; `background.ts` is unchanged from the brief.
3. `addRules as any` cast retained (multi-line action shape not in @types/chrome 0.0.280) as instructed.

## Self-review checklist
- Complete: manifest, background.ts, test all present per brief? YES
- Build copies full manifest to dist/ with permissions? YES (verified)
- YAGNI: nothing beyond brief? YES — only deviation is the test-internal chrome stub required to run the mandated test
- Test pass + typecheck clean? YES