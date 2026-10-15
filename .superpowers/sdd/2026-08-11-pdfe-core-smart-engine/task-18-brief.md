### Task 18: Son doğrulama — tam akış + portfolyo cilası

**Files:**
- Modify: `README.md` (ekran görüntüsü alanı, özellik rozetleri)
- Test: tam suite

**Interfaces:**
- Consumes: tüm görevler
- Produces: Doğrulanabilir tam M1+M2 MVP.

- [ ] **Step 1: Tam test + build + typecheck koş**

Run: `npm run typecheck && npm run test && npm run build`
Expected: tümü yeşil.

- [ ] **Step 2: Doğrulama kriterlerini elle kontrol et (spec §13)**

- `.pdf` açılır → viewer + text layer ✓ (e2e)
- Taranmış PDF → OCR araması ✓ (unit: pipeline fallback)
- Anlamsal arama ✓ (unit: semantic)
- Özet ✓ (unit: summarizer)
- Çevrimdışı + veri sızması yok ✓ (runtime: `allowRemoteModels=false`, `fetch-models` gömülü)
- Testler yeşil ✓

- [ ] **Step 3: README'ye kullanım notu + kapsam (M3-M5) ekle**

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: polish README with usage and roadmap"
```