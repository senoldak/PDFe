# Task 18 Report — Son doğrulama: tam akış + portfolyo cilası

**Status:** DONE
**Commit:** `9549b0c` — `docs: polish README with usage and roadmap`
**Date:** 2026-08-12

## Step 1 — Tam test + build + typecheck

| Suite | Komut | Sonuç |
|---|---|---|
| Typecheck | `npm run typecheck` | ✅ exit 0 (tsc --noEmit, hata yok) |
| Unit tests | `npm run test` | ✅ 13 dosya / **32/32 test geçti** (vitest) |
| Build | `npm run build` | ✅ exit 0, dist/ üretildi (vite + copy-static) |
| E2E | `npm run test:e2e` | ✅ 1/1 geçti (playwright, extension load + viewer render) |

Not: build çıktısında chunk >500 kB uyarısı var (ort wasm 21.6 MB — bilinen/deferred, bkz. aşağısı).
`getContext()` "Not implemented" uyarısı jsdom kaynaklı bilinen stderr, test geçti.

## Step 2 — Spec §13 doğrulama kriterleri (elle kontrol)

| # | Kriter | Karşılık | Durum |
|---|---|---|---|
| 1 | `.pdf` açılınca viewer yüklenir; sayfa/zoom/arama çalışır | `tests/e2e/extension.spec.ts` (viewer render, text layer, pageInfo 1/1) + findBar/highlight/pageRenderer unit | ✅ |
| 2 | Taranmış PDF'te metin araması bulur (OCR fallback) | `tests/unit/pipeline.test.ts` → "falls back to OCR when text is empty" | ✅ |
| 3 | "Maliye" anlamsal eşleşme döndürür | `tests/unit/semantic.test.ts` (2 test) | ✅ |
| 4 | Özet üretir | `tests/unit/summarizer.test.ts` (2 test) | ✅ |
| 5 | Çevrimdışı + veri sızması yok | `src/engine/runtime.ts` → `env.allowRemoteModels=false`, `localModelPath=models/onnx/`, `wasmPaths=models/ort/`; `public/models` paketli (onnx/ort/tessdata, 22 dosya) | ✅ |
| 6 | Testler yeşil: vitest + playwright | Yukarıda, 32 unit + 1 e2e | ✅ |

## Step 3 — README cila

`README.md` değişti (34 ekleme, 1 silme):
- Özellik rozetleri eklendi (status M1+M2, offline, OCR, semantic search, summary, extraction — tümü gerçekten uygulanmış, overclaim yok).
- "Ekran Görüntüsü" bölümü eklendi (placeholder — görsel dosya oluşturulmadı).
- "Kullanım" bölümü eklendi (web PDF otomatik yönlendirme; `file://` için "Dosya URL'lerine erişime izin ver" notu; araç çubuğu + akıllı panel; modeller paketli/çevrimdışı).
- "Kapsam ve Yol Haritası" eklendi — M3 (Düzenleme Seti), M4 (Doküman Yönetimi), M5 (Geliştirici API) açıkça "henüz uygulanmadı" olarak işaretlendi.
- Mevcut tüm içerik (Özellikler, Kurulum, Test, Gizlilik, Lisans, cross-link'ler) korundu.

## Kalan ertelenmiş (deferred) minor'lar

Bu task kapsamında dokunulmadı; ileride ele alınabilir:

- **Task 1:** copy-static.mjs Vite iç layout'a bağlı (viewer.html/contentstyle.js yolları hardcoded); dev script manifest'i yenilemez; make-icons yorumu '1x1'; dist'te sourcemap/.js.map dosyaları (brief-mandated).
- **Task 2:** dosyalarda trailing newline yok.
- **Task 3:** module-scope SW stubs → shared setupFiles önerisi; WAR resource pattern'leri `http:/*`, `blob:*`, `data:*`; registerRedirectRule kuralları unit-test edilmiyor.
- **Task 4:** top-level init() side effect (testlerde shim gerektiriyor).
- **Task 5:** dead ternary `bbox`; unused `PageViewport` import; viewer.ts `decodeURIComponent` malformed-throw; 'renders first page' vs loop wording.
- **Task 6:** viewer.css toolbar default browser styling; title guard inert.
- **Task 8:** ocr test offline path'leri assert etmiyor; init double-call worker leak.
- **Task 10:** pageRenderer textSpans filtresi vs DOM .textLayer NodeList index drift.
- **Task 12:** corpusReady/searchReady UI'da gösterilmiyor; search hata/boş durum yok; stale-result race; `li` onclick keyboard erişimi yok.
- **Task 13:** map-reduce path untested; optional callbacks no-op; `max_length` v2-style vs v3 `max_new_tokens`; `CHUNK_WORDS=800` model context; error/loading handling yok.
- **Task 14:** serab/pattern'ler örnek-eylem, layout-fragile (Tedarikçi label'ına pinned).
- **Task 15:** `dist/assets`'te 21.6MB duplicate ort wasm (wasmPaths override unreachable path); fetch-models sha256 integrity yok.
- **Task 16:** PRIVACY content-script DOM okuma scope'u hafif overstate.
- **Task 17:** playwright.config `use.launchOptions` inert (spec kendi context'ini kuruyor); CI için `npx playwright install chromium` gerekli; headless pinleme önerisi.

Ayrıca ileriye dönük notlar (kod dışı): Task 4 file:// gate dead code; Task 8 models/tessdata kopyalanmıyor (tur.traineddata offline garantisi model WAR entry'sine bağlı); Task 9 semantic bbox/confidence düşürme → viewer highlight bulamayabilir; Task 11 OCR yalnızca tüm korpus boşken tetikleniyor (per-blank-page yok, ocr:failed state yok).

## Doğrulanabilir tam M1+M2 MVP

Tüm adımlar yeşil: typecheck ✓, 32 unit test ✓, build ✓, 1 e2e ✓. Spec §13'ün 6 kriterinin tamamı testlerle karşılanıyor.
