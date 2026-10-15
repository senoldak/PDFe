### Task 17: E2E — Playwright ile gerçek Chrome eklenti testi

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/extension.spec.ts`
- Modify: `package.json` (test:e2e)
- Test: `npm run test:e2e`

**Interfaces:**
- Consumes: Task 1-16 tamamlanmış build (`dist/`)
- Produces: Playwright config + eklenti yükleme testi. Dijital fixture ile viewer açılış + sayfa render + literal arama doğrulanır; OCR/özetleme/embedding testleri `test.skip` (model/worker gerçek çalışma CI'da ağır).

- [ ] **Step 1: playwright.config.ts yaz**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    launchOptions: {
      // Playwright chromium'a --load-extension verilebilmesi için
      args: ["--disable-extensions-except=dist", "--load-extension=dist"],
      channel: "chromium",
    },
  },
});
```
> Not: Chrome MV3 service worker + manifest için `--load-extension` ile yükleme Playwright'ın `chromium` channel'ında çalışır. Manifest'i `dist/manifest.json`'dan okur. `test:e2e` script'i: `"playwright test"`. Önce `npm run build` gerekir (config'te globalSetup ile build zorunlu tutulabilir — basitçe `npm run test:e2e` çalıştırılmadan önce build alındığı varsayılır).

- [ ] **Step 2: tests/e2e/extension.spec.ts yaz**

```ts
import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";

test.describe("PDFE extension", () => {
  test("loads the extension and renders a digital pdf", async () => {
    const extensionPath = path.resolve("dist");
    const ctx = await chromium.launchPersistentContext("", {
      channel: "chromium",
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    const serviceWorker = await ctx.waitForEvent("serviceworker");
    expect(serviceWorker.url()).toContain("background.js");

    const page = await ctx.newPage();
    await page.goto(path.resolve("tests/fixtures/digital.pdf"));
    await page.waitForURL(/viewer\.html/);
    await page.waitForSelector(".textLayer span", { timeout: 15_000 });
    const pageInfo = await page.textContent("#pageInfo");
    expect(pageInfo?.trim()).toMatch(/1 \/ 1/);
    await ctx.close();
  });
});
```
> Not: `file://` PDF'lerde DNR tetiklenmeyebilir; test bunun yerine viewer'ı doğrudan `viewer.html?file=` ile açabilir. Sağlam yol: `page.goto(extensionUrl + "/viewer.html?file=" + encodeURIComponent("file:///.../digital.pdf"))`. `extensionId` background service worker URL'sinden çıkarılır. Bu nedenle testi iki aşamalı yaz: (1) extension service worker'ı bul, extensionId al, (2) viewer'ı doğrudan aç. Aşağıdaki düzeltilmiş sürüm:

```ts
test("renders digital pdf in the viewer", async ({}) => {
  const extensionPath = path.resolve("dist");
  const ctx = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const sw = await ctx.waitForEvent("serviceworker");
  const extId = new URL(sw.url()).host;
  const fileUrl = pathToFileURL(path.resolve("tests/fixtures/digital.pdf")).href;
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${extId}/viewer.html?file=${encodeURIComponent(fileUrl)}`);
  await page.waitForSelector(".textLayer span", { timeout: 15_000 });
  await expect(page.locator("#pageInfo")).toHaveText("1 / 1");
  await ctx.close();
});
```
> `pathToFileURL` için `import pathToFileURL from "node:url"`. Ayrıca `path.resolve("tests/fixtures/digital.pdf")` dosya yolu `file://` URL'ye çevrilir; viewer pdfjs-dist `file://` üzerinden okuyabilir (eklenti `file` erişimi istemez — PDF'i fetch eder; Chrome eklentisi `web_accessible_resources` sayesinde kendi viewer.html'ini açar, PDF dosyasına erişim için `file://` host erişimi gerekir). Bu nedenle `file://` erişimini test etmeden önce manifest'in `host_permissions: ["<all_urls>"]` ve `web_accessible_resources` içindeki `file:/*` girdisi gereklidir — ikisi de mevcut. Kullanıcı el ile "Dosya URL'lerine erişime izin ver" vermediği sürece chrome file URL'lerini engelleyebilir; test ortamında `--allow-file-access-from-files` bayrağı ekle:

`args: [..., "--allow-file-access-from-files"]`

- [ ] **Step 3: package.json'a test:e2e script'i**

```json
"test:e2e": "playwright test"
```

- [ ] **Step 4: e2e çalıştır**

Run: `npm run build && npm run test:e2e`
Expected: test PASS (viewer açılır, `.textLayer span` bulunur, `#pageInfo` = `1 / 1`).

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e package.json
git commit -m "test: add playwright e2e for extension load and viewer render"
```

---