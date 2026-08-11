# PDFE — Çekirdek + Akıllı Motor Tasarım Dokümanı (M1+M2)

Tarih: 2026-08-11
Durum: Onaylandı
Kapsam: Milestone 1 (Çekirdek) + Milestone 2 (Akıllı Motor)

## 1. Vizyon

**PDFE**, tarayıcıda açılan her PDF'i tüm işleri yapan tam yerel bir çalışma alanına
dönüştüren Chrome eklentisidir. Tüm zeka cihazda (WASM) çalışır; hiçbir içerik cihazdan
çıkmaz.

pdf.js'i "geçme" stratejisi: pdf.js yalnızca görüntüleme/yorum/arama yapar. PDFE, görüntüleme
katmanını pdfjs-dist kütüphanesiyle sağlar ve üstüne **yerel akıllı motor** (OCR, anlamsal
arama, özetleme, veri çıkarma) kurar — pdf.js'in asla yapamayacağı alan.

## 2. Karar Tablosu

| Karar | Seçim |
|---|---|
| Proje türü | Açık kaynak / portfolyo projesi |
| Kapsam | Tam platform (A+B+C+D); bu spec M1+M2 |
| Akıllılık | Tamamen yerel (tarayıcı içi, WASM) |
| Teknoloji | TypeScript + Vite, Manifest V3 |
| Render motoru | pdfjs-dist (Apache 2.0, kütüphane bağımlılığı) |
| Arayüz | Tam sayfa viewer (pdf.js tarzı) |
| İnşa sırası | Çekirdek + Akıllı Motor önce |

## 3. Platform Katmanları (İnşa Sırası)

```
M5  Geliştirici API (content script + RPC)
M4  Doküman Yönetimi (IndexedDB arşiv, etiketleme)
M3  Düzenleme Seti (form, imza, sayfa işlemleri, merge/split)
M2  Akıllı Motor (OCR, özetleme, çıkarma, anlamsal arama) — WASM, yerel
M1  Çekirdek (viewer, yönlendirme, pipeline)
    Altyapı: pdfjs-dist (render), Vite/TS, MV3
```

## 4. Klasör Yapısı

```
PDFe/
  src/
    background/      # service worker, DNR, mesaj merkezi
    content/         # content script, PDF yakalama
    viewer/          # viewer UI (hafif TS, Vite)
      pages/         # render, text, annotation katmanları
      components/    # toolbar, sidebar, find bar...
    engine/          # AKILLI MOTOR
      ocr/           # Tesseract.js sarmalayıcı
      text/          # text layer + birleştirme
      search/        # anlamsal arama (embedding)
      summarize/     # özetleme
      extract/       # veri çıkarma şablonları
    shared/          # tipler, araçlar
  tests/             # unit + e2e
  docs/              # mimari, lisanslar, gizlilik
  LICENSE
  README.md
```

## 5. Veri Akışı

```
1. Kullanıcı .pdf linkine tıklar
2. DNR kuralı → chrome-extension://...viewer.html?file=<url>
   (DNR yoksa content script iframe ile yakalar)
3. Viewer: pdfjs-dist getDocument() → PDFDocumentProxy
4. Sayfa render (canvas) + text layer (seçilebilir metin)
5. [Arka planda, paralel] Akıllı Motor:
   - Metin var mı? ──var──→ ham metin, OCR'e girilmez
   - Yok (taranmış) → Tesseract.js OCR (render canvas'ından görsel)
   → HAM METİN KORPUSU (tüm sayfalar birleşik)
   → Embeddings → anlamsal arama
   → Özetleme (kullanıcı tetikler)
   → Veri çıkarma şablonları → yan panel
```

## 6. İş Parçacığı Modeli

- Ana thread: viewer UI + sayfa render (pdfjs-dist)
- Worker 1: Tesseract.js OCR
- Worker 2: transformers.js (embedding + özetleme)
- Service worker: DNR + mesaj merkezi (model dosyaları yalnızca buradan yüklenir)

## 7. Akıllı Motor Bileşenleri

### 7.1 OCR Modülü (`engine/ocr/`)
- Tesseract.js sarmalayıcı, tek worker, sayfa bazında görev kuyruğu
- Sayfa görseli render canvas'ından alınır (tekrar render yok)
- Çıktı: sayfa numarası + kelime konumları (bbox'lar)
- İstisna: çok büyük belgelerde "yalnızca şu sayfalar" seçeneği

### 7.2 Metin Katmanı (`engine/text/`)
- pdfjs-dist text layer + OCR çıktısını tek korpusa birleştirir
- Belge modeli: `{ pageNumber, text, spans[] }`
- OCR bbox'ları seçilebilir metin katmanına hizalanır (taranmış PDF'te arama/seçme)

### 7.3 Anlamsal Arama (`engine/search/`)
- transformers.js cümle embedding + cosine benzerliği
- Kavramsal eşleşme ("fatih" → "İstanbul'un fethi 1453")
- Sonuçlar text_highlighter katmanında vurgulanır
- Regex + kelime araması da desteklenir

### 7.4 Özetleme (`engine/summarize/`)
- transformers.js summarization modeli (butona basınca tetiklenir)
- Çok uzun belgeler: map-reduce (sayfa grupları → özet → birleşik özet)

### 7.5 Veri Çıkarma (`engine/extract/`)
- Şablon + regex kalıpları (JSON schema):
  - Fatura: faturaNo, tarih, tutar, KDV, IBAN, tedarikçi
  - Form: alan değerleri
  - Genel: e-posta, telefon, adres, TC/vergi no, tarih
- M2 sonrası: serbest biçim çıkarımı (LLM tabanlı, ayrı spec)

### 7.6 Bağımlılık Zinciri
OCR → Metin → (Arama | Özetleme | Çıkarma). Modüller bağımsız, test edilebilir.

### 7.7 Model Dosyaları
- OCR: `tur` + `eng` traineddata gömülü
- Embedding: `Xenova/all-MiniLM-L6-v2` (~23MB)
- Özetleme: `Xenova/distilbart-...` isteğe bağlı indirme

## 8. Yönlendirme, UI, Güvenlik

### 8.1 PDF Yakalama/Yönlendirme
- Birincil: DNR kuralı (`Content-Type: application/pdf` veya `.pdf` uzantılı → viewer; POST hariç; `pdfjs.action=download` istisnası)
- Yedek: content script `document_start` iframe yakalama
- İndirme istisnası: `?download=1` parametresi

### 8.2 Viewer UI (`src/viewer/`)
- Hafif TS, framework'süz
- Toolbar: sayfa nav, zoom, rotate, ara, yazdır, indir, Akıllı Panel toggle
- Akıllı Yan Panel: OCR durumu, anlamsal arama, özetleme, çıkarılan veriler (tab'lar)
- Sayfa katmanları: canvas + text layer + highlight layer
- Find bar: normal + anlamsal mod

### 8.3 Güvenlik & Gizlilik
- Tüm işlemler yerel; `host_permissions` minimal; `web_accessible_resources` yalnızca viewer
- Model dosyaları gömülü (ilk kurulumda indirme isteğe bağlı)
- `file://` erişimi kullanıcı onayına bağlı
- CSP: `wasm-unsafe-eval` (worker'lar için zorunlu)
- Gizlilik politikası (belge + eklenti sayfası)

### 8.4 Hata Yönetimi
- OCR başarısız → text layer varsa düşer, yoksa badge gösterir
- Model yüklenemedi → çevrimdışı özellikler devre dışı, kalanlar çalışır
- Yönlendirme çakışması → loop koruması (ikinci kez `?file=` yeniden yönlendirilmez)

## 9. Test Stratejisi

- Vitest: akıllı motor modülleri (gerçek PDF fixture'larıyla)
- Playwright: eklentiyi gerçek Chrome'a yükleyip viewer akışı
- El test: `npm run dev` ile hot reload

## 10. Kapsam Dışı (Sonraki Milestone'lar)

- Düzenleme Seti (form, imza, sayfa işlemleri, merge/split) → M3
- Doküman Yönetimi (IndexedDB arşiv, etiketleme) → M4
- Geliştirici API → M5
- Serbest biçim veri çıkarımı (LLM tabanlı) → M2 sonrası

## 11. Bağımlılıklar

| Paket | Rol | Lisans |
|---|---|---|
| `pdfjs-dist` | PDF parse + render | Apache 2.0 |
| `tesseract.js` | OCR | Apache 2.0 |
| `@huggingface/transformers` | embedding + özetleme | Apache 2.0 |
| `vite`, `typescript`, `vitest`, `playwright` | build + test | — |

## 12. Lisanslama

- Proje: Apache 2.0
- `LICENSE` + `NOTICE` dosyaları
- Gömülü model ağırlıkları `MODEL_LICENSES.md`'de belgelenir
- pdf.js viewer kodu kopyalanmaz; yalnızca `pdfjs-dist` bağımlılığı

## 13. Doğrulama Kriterleri (M1+M2 Tamamlandığında)

1. `.pdf` açılınca viewer yüklenir; sayfa gezme/zoom/arama çalışır
2. Taranmış (OCR gereken) PDF'te metin araması bulur
3. "Maliye" araması fatura içinde anlamsal eşleşme döndürür
4. Özet butonu 5 sayfalık faturanın özetini üretir
5. Tüm işlemler çevrimdışı çalışır; hiçbir veri dışarı çıkmaz
6. Testler yeşil: vitest + playwright
