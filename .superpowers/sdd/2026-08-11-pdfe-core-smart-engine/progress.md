# SDD ledger — plan: docs/superpowers/plans/2026-08-11-pdfe-core-smart-engine.md

Task 1: complete (commits e29e0b6..fa7e7be, review clean)
Task 1: minor (deferred): copy-static.mjs Vite iç layout'a bağlı — viewer.html/contentstyle.js yolları hardcoded; dev script'i manifest'i yenilemez; make-icons yorumu '1x1' diyor (brief'ten verbatim)
Task 1: minor (deferred): dist'e sourcemap/ekstra .js.map dosyaları (brief-mandated, zararsız)
Task 1: ⚠️ manifest tam izinleri bu diff'te doğrulanamaz — Task 3'ün teslimatı, bekleniyor

Task 2: complete (commits fa7e7be..5467ccb, review clean)
Task 2: minor (deferred): dosyalarda trailing newline yok (kozmetyk)

Task 3: complete (commits 5467ccb..5abd145, review clean)
Task 3: minor (deferred): module-scope SW stubs her test icin tekrar gerekecek -> shared setupFiles onerisi
Task 3: minor (deferred): WAR resource patterns http:/*, blob:*, data:* brief-verbatim, Chrome yukleme sanity check Task 18
Task 3: minor (deferred): registerRedirectRule kurallari unit-test'd edilmiyor (brief scope'u)

Task 4: complete (commits 5abd145..15ddb3c, review clean)
Task 4: NOTE -> Task 5 miras: healthCheck ping-pong + viewer:get-url handshake henuz yok (brief-stub), file:// gate dead code (isAllowedFileSchemeAccess callback API)
Task 4: minor (deferred): top-level init() side effect -> export function init() veya window guard alt testlerde shim gerektirmez

Task 5: complete (commits 15ddb3c..939e986, review clean)
Task 5: note - getPageText Interfaces'ta ama consumer yok, YAGNI ile cikarildi (Task11 getTextContent kullaniyor)
Task 5: minor (deferred): dead ternary bbox, unused PageViewport import, viewer.ts decodeURIComponent malformed-throw, 'renders first page' vs loop wording

Task 6: complete (commits 939e986..da05da6, review clean)
Task 6: minor (deferred): viewer.css brief Files'ta ama degistirilmedi (toolbar default browser styling; css icerigi plan'da yok)
Task 6: minor (deferred): title guard olumlu ama inert (gelecekteki task icin)
Task 7: complete (commits da05da6..1346053, review clean)

Task 8: complete (commits 1346053..72fba79, review clean)
Task 8: NOTE -> Task 11/15: copy-static worker+core kopyaliyor ama models/tessdata degil; tur.traineddata offline garantisi model WAR entry'sine bagli - pipeline'da dogrula
Task 8: minor (deferred): ocr test offline path'leri assert etmiyor; init double-call worker leak

Task 9: complete (commits 72fba79..5a186d7)
Task 9: deviation -> brief verbatim kodda private field `index` ile method `index()` cakisti (field, prototype method'u golgeliyor); minimal fix: field adi `indexed` yapildi, public API degismedi
Task 9: NOTE -> offline garantisi caller'da: env.allowRemoteModels=false + env.localModelPath=<chrome-extension>/models/ (v3.8.1 validModelId -> localModelPath+modelId). semantic.ts model'i ID olarak tutuyor, URL degil; env wiring Worker glue (Task 11/15) isi. Xenova/all-MiniLM-L6-v2 dosyalari henuz public/models icinde yok

Task 9: complete (commits 72fba79..5a186d7, review clean)
Task 9: NOTE -> Task 10/12: semantic search bbox/confidence dusuruyor (span.cast) - viewer highlight bolgeyi bulamayabilir
Task 9: NOTE -> Task 15: offline gate runtime.ts env.allowRemoteModels=false zorunlu; span-level index (gercek cumle splitter yok)

Task 10: complete (commits 5a186d7..6abe9f8, review Needs-fixes -> fix 6abe9f8 verified, APPROVED)
Task 10: IMPORTANT (fixed): findInSpans flat->page-local spanIndex (multi-page highlight bozuk) - 6abe9f8
Task 10: minor (deferred): pageRenderer textSpans filtresi vs DOM .textLayer NodeList index drift - Task 17 sanity check

Task 11: complete (commits 6abe9f8..35a19d0, review clean)
Task 11: NOTE -> Task 12: OCR sadece tum korpus bosken tetikleniyor; karisik dijital+taranmis doc'larda bos sayfalar dolmaz (per-blank-page dusunulmeli), ocr:failed state'i yok, Pipelinedeps'ta olumlu path'ler (ocrLangPath vb kullanilmiyor)

Task 12: complete (commits 35a19d0..4eba61c, review Needs-fixes -> fix 4eba61c verified, APPROVED)
Task 12: IMPORTANT (fixed): result-click highlight yoktu, onHighlight(pageNumber) spanIndex'i dusuruyordu -> 4eba61c onHighlight(SearchResult)+highlightSpans+scroll
Task 12: minor (deferred): corpusReady/searchReady UI'da gosterilmiyor; search hata/bos durum yok; stale-result race; li onclick keyboard yok

Task 13: complete (commits 4eba61c..063f383, review clean)
Task 13: NOTE -> Task 15: map-reduce path untested (1 chunk only), optional callbacks no-op until wiring, max_length v2-style vs v3 max_new_tokens, CHUNK_WORDS=800 model context'ta, error/loading handling yok

Task 14: complete (commits 063f383..b6ae53a, review clean)
Task 14: note - tutar/tedarikci regex fix'leri dogrulandi; serab/pattern'ler ornek-eylem, layout-fragile (Tedarikci: labeline pinned)

Task 15: complete (commits b6ae53a..412b1ba, review Needs-fixes -> fix 412b1ba verified, APPROVED)
Task 15: CRITICAL (fixed): OCR langPath tesseract/ vs packaged models/tessdata/ + gzip default true 404 -> 412b1ba langPath+gzip:false
Task 15: deviation (justified): allowRemoteWasm yok v3 -> wasmPaths=models/ort/; decoder_model_merged_quantized; HF repo layout; tessdata github kaynagi (projectnaptha olu)
Task 15: minor (deferred): dist/assets'ta 21.6MB duplicate ort wasm (wasmPaths override unreachable path); fetch-models sha256 intact yok; commit msg brief'ten farkli

Task 16: complete (commits 412b1ba..28f6b67, review clean)
Task 16: note - fixture base64 fix dogrulandi; README test:e2e komutu Task 17'de gecerli olacak; PRIVACY content-script DOM okuma scope'u hafif overstate

Task 17: complete (commits 28f6b67..7252c3b, review clean)
Task 17: minor (deferred): playwright.config use.launchOptions inert (spec kendi context'ini kuruyor); CI icin npx playwright install chromium gerekli; headless pinlesin

Task 18: complete (commits 7252c3b..9549b0c, review clean) - PLAN TAMAMLANDI
FINAL: all suites green - typecheck + 32/32 unit + build + 1/1 e2e
FINAL: deferred minors repo'da kaldi, listed in task-18-report; kritik/önemli acik kalem YOK

POLISH PASS (parallel agents, commits 890737e..d7115cc): task-18-report deferred minors çözüldü
  890737e feat: harden build tooling and prune duplicate ort wasm (copy-static glob discovery, ort wasm prune -> tek kopya models/ort/, fetch-models sha256 integrity 17/17, make-icons '1x1' yorum fix, closeBundle plugin, manifest WAR invalid file:-pattern'leri düşürüldü)
  364e342 test: add shared chrome setup and restore e2e headless config (tests/unit/setup.ts, inline chrome shims silindi, registerRedirectRule exported, inert launchOptions kaldırıldı, headless:true pinlendi, dead file:// gate kaldırıldı)
  5d69a0d fix: harden engine pass into v3 kwargs, ocr failure state and worker cleanup (max_new_tokens, CHUNK_WORDS düşürüldü, ocr:failed state, worker terminate, bbox/confidence korundu)
  76ccb2c fix: align text spans with text layer for stable highlight indexing (1:1 DOM alignment)
  0fb13c1 feat: wire summarize and surface corpus/search readiness in panel (decodeURIComponent guard, error/empty/kbd/stale-race, summarize kablolaması)
  d7115cc docs: clarify content-script scope in privacy policy
POLISH NOTE: agent'lar vite.config.ts'i çift düzenledi -> setupFiles ilk commit'te kayboldu, coordinator restore etti
POLISH NOTE: semantik highlight spanIndex hâlâ corpus-filtered pipeline spans'ini kullanıyor (viewer.ts onHighlight <-> pipeline.ts textSpans filtre) -> önemli olmayan kalıntı, takip TODO
POLISH FINAL: all suites green - typecheck + 45/45 unit + build (tek ort wasm) + 1/1 e2e (3.2s)
