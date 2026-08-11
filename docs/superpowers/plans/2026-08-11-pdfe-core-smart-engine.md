# PDFE — Çekirdek + Akıllı Motor (M1+M2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chrome eklentisi olarak, tarayıcıda açılan PDF'leri pdfjs-dist üstüne kurulu özel bir viewer'da gösteren ve tamamen yerel (WASM) OCR, anlamsal arama, özetleme ve veri çıkarma yapan bir Akıllı Motor çalıştıran çalışan bir MVP üretmek.

**Architecture:** Manifest V3 eklentisi. `background` service worker, PDF isteklerini DNR kuralıyla `viewer.html?file=<url>` adresine yönlendirir. Viewer, pdfjs-dist ile sayfaları canvas'a render eder ve text layer üretir. Akıllı Motor, sayfa gezinmeden bağımsız olarak arka planda korpus oluşturur: dijital metin varsa doğrudan, yoksa Tesseract.js OCR ile; ardından transformers.js ile embedding (anlamsal arama), özetleme ve şablon tabanlı veri çıkarma yapar. Tüm zeka worker'larda çalışır, hiçbir içerik cihazdan çıkmaz.

**Tech Stack:** TypeScript 5.x, Vite 6+, Manifest V3, pdfjs-dist, tesseract.js, @huggingface/transformers (transformers.js), vitest, playwright. Build: `vite build` (manuel multi-entry, eklenti için).

## Global Constraints

- Manifest V3; `minimum_chrome_version` = `128` (DNR `responseHeaders` koşulu için).
- İzinler: `declarativeNetRequestWithHostAccess`, `tabs`, `webNavigation`, `storage`. Host permissions: `<all_urls>`.
- CSP: `"script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"` (worker'lar için zorunlu).
- Tüm zeka yerel: hiçbir fetch, dış API çağrısı, içerik gönderimi yok. Model dosyaları `public/models/` altına gömülür.
- İzin verilen modeller: OCR = `tur` + `eng` traineddata; embedding = `Xenova/all-MiniLM-L6-v2`; özetleme = `Xenova/distilbart-cnn-6-6`.
- pdf.js viewer kodu kopyalanmaz; yalnızca `pdfjs-dist` npm bağımlılığı kullanılır.
- Tüm kullanıcıya dönük metin Türkçe olur (portfolyo dili: Türkçe UI, Türkçe yorum satırı yok — kod İngilizce tanımlayıcı, UI string'leri Türkçe).
- Yorum satırı eklenmez (kod içi).
- Commits: her görev sonunda ayrı, mesajı `feat:`, `test:`, `docs:` ön ekiyle.

---

### Task 1: Proje iskeleti + build altyapısı

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `scripts/copy-static.mjs`
- Create: `public/manifest.json`
- Create: `public/icons/icon16.png`, `public/icons/icon48.png`, `public/icons/icon128.png` (yer tutucu — 16/48/128px katı renk PNG)
- Create: `.gitignore`
- Create: `public/models/README.md`
- Test: `npm run build`

**Interfaces:**
- Consumes: —
- Produces: `npm run build` → `dist/` klasöründe `manifest.json`, `background.js`, `contentscript.js`, `viewer.html` + chunk'lar, `contentstyle.css`, `icons/`, `models/`. `npm run dev` → `dist/` + watch.

- [ ] **Step 1: package.json yaz**

```json
{
  "name": "pdfe",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "vite build && node scripts/copy-static.mjs",
    "dev": "vite build --watch",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.280",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0",
    "@playwright/test": "^1.49.0"
  },
  "dependencies": {
    "pdfjs-dist": "^4.10.0",
    "tesseract.js": "^5.1.0",
    "@huggingface/transformers": "^3.0.0"
  }
}
```

- [ ] **Step 2: tsconfig.json yaz**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["chrome"],
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src", "tests", "vite.config.ts", "scripts"]
}
```

- [ ] **Step 3: vite.config.ts yaz** (manuel multi-entry — eklenti için tek HTML + iki script)

```ts
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        viewer: resolve(__dirname, "src/viewer/viewer.html"),
        background: resolve(__dirname, "src/background/background.ts"),
        contentscript: resolve(__dirname, "src/content/contentscript.ts"),
        contentstyle: resolve(__dirname, "src/content/contentstyle.css"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  worker: {
    format: "es",
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: scripts/copy-static.mjs yaz** (manifest + icons + modelleri dist'e kopyalar; PDF worker'ı `dist/` içinde `pdf.worker.mjs` olarak kopyalanır)

```js
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

mkdirSync(dist, { recursive: true });

cpSync(resolve(root, "public/manifest.json"), resolve(dist, "manifest.json"));
cpSync(resolve(root, "public/icons"), resolve(dist, "icons"), { recursive: true });
if (existsSync(resolve(root, "public/models"))) {
  cpSync(resolve(root, "public/models"), resolve(dist, "models"), { recursive: true });
}

const pdfWorker = resolve(root, "node_modules/pdfjs-dist/build/pdf.worker.mjs");
if (existsSync(pdfWorker)) {
  cpSync(pdfWorker, resolve(dist, "pdf.worker.mjs"));
}
console.log("Static assets copied to dist/");
```

- [ ] **Step 5: .gitignore yaz**

```
node_modules/
dist/
test-results/
playwright-report/
```

- [ ] **Step 6: yer tutucu ikonları üret** — `scripts/make-icons.mjs` (bağımlılıksız, saf PNG üretici)

Create `scripts/make-icons.mjs`:
```js
// scripts/make-icons.mjs — 1x1 solid PNG üretici (bağımlılıksız)
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

function crc32(buf) { let c, table = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } let crc = 0xffffffff; for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.from(type, "ascii"); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); }
function png(size) { const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2; const idat = Buffer.concat(Array.from({ length: size }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3).fill(Buffer.from([0, 122, 255]))]))); return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]); }
mkdirSync("public/icons", { recursive: true });
for (const s of [16, 48, 128]) writeFileSync(resolve("public/icons/icon" + s + ".png"), png(s));
console.log("icons written");
```

Run: `node scripts/make-icons.mjs` → `public/icons/icon16.png`, `icon48.png`, `icon128.png` oluşur (geçerli PNG — Playwright yükleme testinde kullanılır).

Run: `node scripts/make-icons.mjs` → `public/icons/icon16.png`, `icon48.png`, `icon128.png` oluşur.

- [ ] **Step 7: src/background/background.ts ve src/content/contentscript.ts ve src/viewer/viewer.html için geçici iskelet dosyalar oluştur** (sonraki görevlerde doldurulacak; build'in kırılmaması için boş export'lar yeterli):

`src/background/background.ts`:
```ts
export {};
```
`src/content/contentscript.ts`:
```ts
export {};
```
`src/viewer/viewer.html`:
```html
<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <title>PDFE</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./viewer.ts"></script>
  </body>
</html>
```
`src/viewer/viewer.ts`:
```ts
document.getElementById("app")!.textContent = "PDFE";
```

- [ ] **Step 8: build'i doğrula**

Run: `npm install && npm run build`
Expected: `dist/manifest.json`, `dist/background.js`, `dist/contentscript.js`, `dist/viewer.html`, `dist/contentstyle.css`, `dist/icons/`, `dist/pdf.worker.mjs` oluşur. Hata yok.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Manifest V3 extension with Vite multi-entry build"
```

---

### Task 2: Shared tipler + mesaj protokolü

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/messages.ts`
- Test: `tests/unit/types.test.ts`

**Interfaces:**
- Consumes: —
- Produces: Aşağıdaki tip/mesaj tanımları sonraki tüm görevlerin sözleşmesi.

- [ ] **Step 1: src/shared/types.ts yaz**

```ts
export interface Bbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TextSpan {
  text: string;
  bbox?: Bbox;
  confidence?: number;
}

export interface PageText {
  pageNumber: number;
  text: string;
  spans: TextSpan[];
  source: "textlayer" | "ocr";
}

export interface DocumentCorpus {
  pages: PageText[];
  fullText: string;
}

export interface SearchResult {
  pageNumber: number;
  spanIndex: number;
  span: TextSpan;
  score: number;
  kind: "semantic" | "literal" | "regex";
}

export interface ExtractionResult {
  [field: string]: string | number | null;
}

export type OcrStatus = "idle" | "loading" | "running" | "done" | "failed";
export type EngineState = {
  ocr: OcrStatus;
  ocrProgress: number; // 0..1
  corpusReady: boolean;
  searchReady: boolean;
};

export interface ExtractionSchema {
  fields: Record<string, { label: string; pattern: string }>;
}
```

- [ ] **Step 2: src/shared/messages.ts yaz**

```ts
import type { DocumentCorpus, SearchResult, ExtractionResult, EngineState } from "./types";

export type Message =
  | { type: "engine:ocr-progress"; progress: number }
  | { type: "engine:corpus-ready"; corpus: DocumentCorpus }
  | { type: "engine:state"; state: EngineState }
  | { type: "engine:search"; query: string }
  | { type: "engine:search-results"; results: SearchResult[] }
  | { type: "engine:summarize"; text: string }
  | { type: "engine:summary"; summary: string }
  | { type: "engine:extract"; schemaId: string }
  | { type: "engine:extracted"; result: ExtractionResult }
  | { type: "viewer:navigate"; page: number }
  | { type: "viewer:get-url" }
  | { type: "viewer:url"; url: string };

export type MessageHandler = (msg: Message) => void;
```

- [ ] **Step 3: tests/unit/types.test.ts yaz**

```ts
import { describe, expect, it } from "vitest";
import type { DocumentCorpus, PageText } from "../../src/shared/types";

describe("shared types", () => {
  it("DocumentCorpus is built from PageText items", () => {
    const page: PageText = {
      pageNumber: 1,
      text: "hello",
      spans: [{ text: "hello", bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } }],
      source: "textlayer",
    };
    const corpus: DocumentCorpus = { pages: [page], fullText: "hello" };
    expect(corpus.pages[0].text).toBe("hello");
    expect(corpus.fullText).toContain("hello");
  });
});
```

- [ ] **Step 4: testi çalıştır, başarısız olmalı (derleme yoksa)**

Run: `npm run test`
Expected: dosya yoksa "No test files found" değilse import hatası. Test dosyası yazıldıktan sonra `npx vitest run tests/unit/types.test.ts` PASS olur (saf tip testi — implementasyon içermediğinden ilk koşuda geçer; bu görevde amaç sözleşmeyi sabitlemek).

- [ ] **Step 5: Commit**

```bash
git add src/shared tests/unit/types.test.ts
git commit -m "feat: define shared types and message protocol"
```

---

### Task 3: Background service worker + DNR yönlendirme

**Files:**
- Create: `src/background/background.ts` (mevcut iskeleti doldur)
- Modify: `public/manifest.json` (izinler + background + DNR)
- Test: `tests/unit/background.test.ts`

**Interfaces:**
- Consumes: `chrome.declarativeNetRequest`, `chrome.webNavigation`, `chrome.runtime`
- Produces: PDF isteklerini `chrome-extension://<id>/viewer.html?file=<url>` adresine yönlendiren DNR kuralı; `viewer:get-url` mesajına URL döner; `?download=1` istisnası; file:// fallback'i.

- [ ] **Step 1: public/manifest.json yaz**

```json
{
  "manifest_version": 3,
  "name": "PDFE — Yerel Akıllı PDF",
  "version": "0.1.0",
  "description": "Tarayıcıda açılan PDF'leri tamamen yerel akıllı araçlarla işler: OCR, anlamsal arama, özetleme, veri çıkarma.",
  "minimum_chrome_version": "128",
  "permissions": [
    "declarativeNetRequestWithHostAccess",
    "tabs",
    "webNavigation",
    "storage"
  ],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "background.js", "type": "module" },
  "content_scripts": [
    {
      "matches": ["http://*/*", "https://*/*", "file://*/*"],
      "run_at": "document_start",
      "all_frames": true,
      "css": ["contentstyle.css"],
      "js": ["contentscript.js"]
    }
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_title": "PDFE"
  },
  "web_accessible_resources": [
    {
      "resources": [
        "viewer.html",
        "pdf.worker.mjs",
        "models/*",
        "http:/*",
        "https:/*",
        "file:/*",
        "blob:*",
        "data:*"
      ],
      "matches": ["<all_urls>"]
    }
  ]
}
```

- [ ] **Step 2: src/background/background.ts yaz** (tasarıma uygun sadeleştirilmiş DNR + file:// fallback + mesaj merkezi)

```ts
const VIEWER_URL = chrome.runtime.getURL("viewer.html");

export function getViewerUrl(pdfUrl: string, baseUrl = VIEWER_URL): string {
  const hashIndex = pdfUrl.indexOf("#");
  let hash = "";
  if (hashIndex > 0) {
    hash = pdfUrl.slice(hashIndex);
    pdfUrl = pdfUrl.slice(0, hashIndex);
  }
  return `${baseUrl}?file=${encodeURIComponent(pdfUrl)}${hash}`;
}

async function registerRedirectRule(): Promise<void> {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  if (rules.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: rules.map((r) => r.id),
    });
  }

  const redirectToViewer = {
    type: "redirect",
    redirect: { regexSubstitution: `${VIEWER_URL}?file=\\0` },
  } as const;

  const addRules = [
    {
      id: 1,
      priority: 2,
      condition: { urlFilter: "pdfe.action=download", resourceTypes: ["main_frame", "sub_frame"] },
      action: { type: "allow" as const },
    },
    {
      id: 2,
      priority: 1,
      condition: {
        regexFilter: "^.*$",
        excludedRequestMethods: ["post"],
        resourceTypes: ["main_frame", "sub_frame"],
        responseHeaders: [{ header: "content-type", values: ["application/pdf", "application/pdf;*"] }],
      },
      action: redirectToViewer,
    },
    {
      id: 3,
      priority: 1,
      condition: {
        regexFilter: "^.*\\.pdf\\b.*$",
        excludedRequestMethods: ["post"],
        resourceTypes: ["main_frame", "sub_frame"],
        responseHeaders: [
          { header: "content-type", values: ["application/octet-stream", "application/octet-stream;*"] },
        ],
      },
      action: redirectToViewer,
    },
  ];

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: addRules as any });
  } catch (e) {
    console.error("DNR rule registration failed; falling back to content script.", e);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void registerRedirectRule();
});
chrome.runtime.onStartup.addListener(() => {
  void registerRedirectRule();
});

chrome.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    if (details.frameId !== 0) return;
    chrome.extension.isAllowedFileSchemeAccess((isAllowed) => {
      if (isAllowed) return;
      chrome.tabs.update(details.tabId, { url: getViewerUrl(details.url) });
    });
  },
  { url: [{ urlPrefix: "file://", pathSuffix: ".pdf" }, { urlPrefix: "file://", pathSuffix: ".PDF" }] }
);

chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
  if (message?.type === "viewer:get-url") {
    sendResponse({ type: "viewer:url", url: getViewerUrl(message.file ?? "") });
    return true;
  }
  return undefined;
});

export {};
```

- [ ] **Step 3: tests/unit/background.test.ts yaz** (DNR mantığı saf fonksiyon olarak test edilir — `getViewerUrl`'yi export etmek için background.ts'yi düzenle)

Modify `src/background/background.ts`: `getViewerUrl`'yi `export function getViewerUrl(...)` yap.

```ts
import { describe, expect, it } from "vitest";
import { getViewerUrl } from "../../src/background/background";

describe("getViewerUrl", () => {
  it("encodes the pdf url as file param", () => {
    const url = getViewerUrl("https://example.com/a.pdf");
    expect(url).toBe(
      "chrome-extension://__EXTENSION_ID__/viewer.html?file=" + encodeURIComponent("https://example.com/a.pdf")
    );
  });

  it("keeps fragment out of the encoded file param", () => {
    const url = getViewerUrl("https://example.com/a.pdf#page=2");
    expect(url).toContain("?file=" + encodeURIComponent("https://example.com/a.pdf"));
    expect(url.endsWith("#page=2")).toBe(true);
  });
});
```
> Not: `getViewerUrl` `chrome.runtime.getURL("viewer.html")` çağırır; test ortamında `chrome` yoktur. Bunun için `getViewerUrl`'yi worker'sız saf fonksiyona çevir: imza `getViewerUrl(pdfUrl: string, baseUrl = chrome.runtime.getURL("viewer.html"))`. Test ikinci argümanı `"chrome-extension://__EXTENSION_ID__/viewer.html"` vererek çağırır. Implementasyonu buna göre düzenle.

- [ ] **Step 4: testi çalıştır**

Run: `npm run test`
Expected: `tests/unit/background.test.ts` PASS.

- [ ] **Step 5: build + typecheck doğrula**

Run: `npm run typecheck && npm run build`
Expected: hatasız.

- [ ] **Step 6: Commit**

```bash
git add src/background public/manifest.json tests/unit/background.test.ts
git commit -m "feat: register DNR rules to redirect PDFs to the viewer"
```

---

### Task 4: Content script — PDF yakalama + iframe yedeği

**Files:**
- Create: `src/content/contentscript.ts` (mevcut iskeleti doldur)
- Create: `src/content/contentstyle.css` (mevcut boş dosyayı doldur)
- Test: `tests/unit/contentscript.test.ts`

**Interfaces:**
- Consumes: `chrome.runtime`, `chrome.extension`
- Produces: `window.postMessage` ile `{ type: "pdfe:detect-pdf", url }` yayınlar; `?pdfe=embed` parametresiyle viewer'ı iframe'de açar; body'ye `pdfe-content` class'ı ekler.

- [ ] **Step 1: src/content/contentscript.ts yaz**

```ts
import type { Message } from "../shared/messages";

function isPdfUrl(url: string): boolean {
  const clean = url.split("#")[0].split("?")[0];
  return /\.pdf$/i.test(clean);
}

function detectPdfInDom(): boolean {
  const embeds = document.querySelectorAll("embed[type='application/pdf'], object[type='application/pdf']");
  const iframes = document.querySelectorAll("iframe[src$='.pdf' i]");
  return embeds.length > 0 || iframes.length > 0;
}

function embedViewer(url: string): void {
  const iframe = document.createElement("iframe");
  const viewerUrl = chrome.runtime.getURL(`viewer.html?file=${encodeURIComponent(url)}&pdfe=embed`);
  iframe.src = viewerUrl;
  iframe.setAttribute("style", "position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483647;");
  document.documentElement.appendChild(iframe);
  document.body.classList.add("pdfe-content");
}

function init(): void {
  const currentUrl = window.location.href;
  if (isPdfUrl(currentUrl) && !currentUrl.includes("pdfe=embed")) {
    window.postMessage({ type: "pdfe:detect-pdf", url: currentUrl }, "*");
    if (!chrome.extension.isAllowedFileSchemeAccess || document.contentType !== "application/pdf") {
      // DNR yoksa ve PDF DOM'da render ediliyorsa iframe ile yakala.
    }
  }
  if (detectPdfInDom()) {
    const src = (document.querySelector("embed[type='application/pdf']") as HTMLElement | null)?.getAttribute("src");
    if (src) embedViewer(new URL(src, location.href).href);
  }
}

window.addEventListener("message", (event: MessageEvent<Message>) => {
  if (event.data?.type === "viewer:url") return;
});

init();
```

- [ ] **Step 2: src/content/contentstyle.css yaz**

```css
html:has(> body.pdfe-content) {
  overflow: hidden;
}
```

- [ ] **Step 3: tests/unit/contentscript.test.ts yaz** — DOM mantığını saf fonksiyonlarla test etmek için `isPdfUrl`'yi export et; content script'in DOM yükleme yan etkisi jsdom olmadan test edilemez, bu yüzden yalnızca saf kısım test edilir.

Modify `src/content/contentscript.ts`: `isPdfUrl`'yi `export function isPdfUrl(...)` yap.

```ts
import { describe, expect, it } from "vitest";
import { isPdfUrl } from "../../src/content/contentscript";

describe("isPdfUrl", () => {
  it("matches .pdf urls", () => {
    expect(isPdfUrl("https://x.com/a.pdf")).toBe(true);
    expect(isPdfUrl("https://x.com/a.PDF?token=1")).toBe(true);
    expect(isPdfUrl("https://x.com/a.pdf#page=3")).toBe(true);
  });
  it("rejects non-pdf urls", () => {
    expect(isPdfUrl("https://x.com/a.html")).toBe(false);
    expect(isPdfUrl("https://x.com/a.pdfx")).toBe(false);
  });
});
```

- [ ] **Step 4: testi çalıştır + build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS, hatasız build.

- [ ] **Step 5: Commit**

```bash
git add src/content tests/unit/contentscript.test.ts
git commit -m "feat: content script PDF detection with iframe fallback"
```

---

### Task 5: Viewer çekirdeği — pdfjs-dist yükleme + sayfa render + text layer

**Files:**
- Create: `src/viewer/viewer.ts` (mevcut iskeleti doldur)
- Create: `src/viewer/pdfLoader.ts`
- Create: `src/viewer/pageRenderer.ts`
- Create: `src/viewer/viewer.css`
- Test: `tests/unit/pageRenderer.test.ts`

**Interfaces:**
- Consumes: pdfjs-dist `getDocument`, `GlobalWorkerOptions`, `TextLayer`; `viewer:get-url` mesajı (Task 3)
- Produces: `loadDocument(url: string): Promise<PDFDocumentProxy>`, `renderPage(page, canvas, viewport, container): Promise<{ textLayer: TextLayer, spans: TextSpan[] }>`, `getPageText(page, viewport): Promise<{ items: ...; }>` — sonraki görevlere korpus besler.

- [ ] **Step 1: src/viewer/pdfLoader.ts yaz** (Vite uyumlu worker kurulumu)

```ts
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.mjs");

export async function loadDocument(url: string): Promise<PDFDocumentProxy> {
  const task = getDocument({ url });
  return task.promise;
}
```

- [ ] **Step 2: src/viewer/pageRenderer.ts yaz**

```ts
import { TextLayer, type PageViewport } from "pdfjs-dist";
import type { PDFPageProxy } from "pdfjs-dist";
import type { TextSpan } from "../shared/types";

export interface RenderedPage {
  textSpans: TextSpan[];
  canvas: HTMLCanvasElement;
}

export async function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  scale: number
): Promise<RenderedPage> {
  const viewport = page.getViewport({ scale });
  const outputScale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport, transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null }).promise;

  const textDiv = document.createElement("div");
  textDiv.className = "textLayer";
  container.appendChild(textDiv);

  const textContent = await page.getTextContent();
  const textLayer = new TextLayer({
    textContentSource: textContent,
    container: textDiv,
    viewport,
  });
  await textLayer.render();

  const spans: TextSpan[] = [];
  for (const item of textContent.items) {
    const s = item as any;
    if (typeof s.str === "string" && s.str.trim()) {
      spans.push({ text: s.str, bbox: s.transform ? undefined : undefined, confidence: undefined });
    }
  }
  return { textSpans: spans, canvas };
}
```
> Not: `getTextContent()` dönen `TextContent` aynı zamanda `textContentSource` olarak `TextLayer`'a verilir (ReadableStream değilse içeride sarılır). `bbox` üretimi için `page.getTextContent()` içindeki `item.transform` + `item.width/height` kullanılabilir; bu görevde `spans[].text` yeterlidir, bbox Takım 11'de doldurulur.

- [ ] **Step 3: src/viewer/viewer.css yaz** (temel layout + text layer görünümü)

```css
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; font-family: system-ui, sans-serif; background: #2b2b2b; color: #eee; }
#app { display: flex; flex-direction: column; height: 100vh; }
#toolbar { display: flex; gap: 8px; align-items: center; padding: 8px; background: #1f1f1f; }
#pages { flex: 1; overflow: auto; padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.page-container { position: relative; box-shadow: 0 2px 12px rgba(0,0,0,.5); }
.textLayer { position: absolute; inset: 0; overflow: hidden; opacity: .25; line-height: 1; text-align: initial; transform-origin: 0 0; }
.textLayer span { position: absolute; white-space: pre; cursor: text; transform-origin: 0% 0%; }
.textLayer ::selection { background: rgba(0, 122, 255, .6); }
```

- [ ] **Step 4: src/viewer/viewer.ts yaz** (başlangıç: URL'den file çıkar, dokümanı yükle, ilk sayfayı render et)

```ts
import "./viewer.css";
import { loadDocument } from "./pdfLoader";
import { renderPage } from "./pageRenderer";

function getFileParam(): string {
  const url = new URL(location.href);
  const file = url.searchParams.get("file");
  if (file) return decodeURIComponent(file);
  return "";
}

async function init(): Promise<void> {
  const file = getFileParam();
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <div id="toolbar"><span id="title"></span></div>
    <div id="pages"></div>
  `;
  document.getElementById("title")!.textContent = file.split("/").pop() || file;

  const pages = document.getElementById("pages")!;
  const pdf = await loadDocument(file);
  const pageCount = pdf.numPages;

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const container = document.createElement("div");
    container.className = "page-container";
    pages.appendChild(container);
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);
    await renderPage(page, canvas, container, 1.25);
    page.cleanup();
  }
}

void init();
```

- [ ] **Step 5: tests/unit/pageRenderer.test.ts yaz** — `page.render` mock'lu basit render sonucu kontrolü

```ts
import { describe, expect, it, vi } from "vitest";
import type { PDFPageProxy } from "pdfjs-dist";

function mockPage(): PDFPageProxy {
  const viewport = { width: 100, height: 200, scale: 1, rotation: 0, rawDims: { pageWidth: 100, pageHeight: 200, pageX: 0, pageY: 0 } };
  return {
    getViewport: (opts: any) => ({ ...viewport, scale: opts.scale }),
    render: vi.fn().mockResolvedValue({ promise: Promise.resolve() }),
    getTextContent: vi.fn().mockResolvedValue({ items: [{ str: "merhaba", width: 10, height: 10, transform: [1, 0, 0, 1, 0, 0] }] }),
    cleanup: vi.fn(),
  } as unknown as PDFPageProxy;
}

describe("renderPage", () => {
  it("returns text spans from text content", async () => {
    const { renderPage } = await import("../../src/viewer/pageRenderer");
    const page = mockPage();
    const canvas = document.createElement("canvas");
    const container = document.createElement("div");
    const result = await renderPage(page, canvas, container, 1);
    expect(result.textSpans.length).toBe(1);
    expect(result.textSpans[0].text).toBe("merhaba");
  });
});
```
> Not: Bu test DOM gerektirir; `vitest` config'ine `environment: "jsdom"` eklemek gerekir. `npm i -D jsdom` ve `vite.config.ts` içinde `test.environment`'ı `"jsdom"` yap; unit testlerin çoğu saf mantık olduğundan jsdom'a geçmek sorun değildir. `environment`'ı jsdom yap ve `document.createElement` çağrıları için jsdom DOM'u yeterli. `TextLayer` gerçek render'ı jsdom'da worker gerektirmez ama `page.getTextContent()` mock'landığı için sorun olmaz. Ancak `new TextLayer({...}).render()` gerçek bir ReadableStream bekler; mock'lu `textContent` objesi geçildiğinde içeride stream'e sarılır. Bu testte `render()` sonrası span'lar bizim döngümüzden gelir — TextLayer render'ı jsdom'da DOM'a yazar; çakışma olmaması için `container.appendChild(textDiv)` gerçekleşir ve sorunsuz çalışır.

- [ ] **Step 6: jsdom kur + testi çalıştır**

Run: `npm i -D jsdom`
Modify `vite.config.ts`: `test: { environment: "jsdom", include: ["tests/unit/**/*.test.ts"] }`
Run: `npm run test`
Expected: PASS.

- [ ] **Step 7: build + typecheck**

Run: `npm run typecheck && npm run build`
Expected: hatasız.

- [ ] **Step 8: Commit**

```bash
git add src/viewer tests/unit/pageRenderer.test.ts vite.config.ts package.json
git commit -m "feat: render PDF pages with pdfjs-dist and text layer"
```

---

### Task 6: Viewer UI — toolbar, gezinme, zoom, ara (literal)

**Files:**
- Create: `src/viewer/toolbar.ts`
- Create: `src/viewer/findBar.ts`
- Modify: `src/viewer/viewer.ts`
- Modify: `src/viewer/viewer.css`
- Test: `tests/unit/toolbar.test.ts`

**Interfaces:**
- Consumes: `renderPage` (Task 5)
- Produces: `createToolbar({ onNavigate, onZoom, onFind }): HTMLElement`, `createFindBar({ onFind })` — literal arama (regex destekli), sonuçlara `find-result` class'ı ekler.

- [ ] **Step 1: src/viewer/toolbar.ts yaz**

```ts
export interface ToolbarCallbacks {
  onNavigate: (delta: number) => void;
  onZoom: (factor: number) => void;
  onFind: (query: string) => void;
  onToggleSmartPanel: () => void;
}

export function createToolbar(cb: ToolbarCallbacks): HTMLElement {
  const el = document.createElement("div");
  el.id = "toolbar";
  el.innerHTML = `
    <button data-act="prev" title="Önceki sayfa">‹</button>
    <span id="pageInfo">1 / 1</span>
    <button data-act="next" title="Sonraki sayfa">›</button>
    <button data-act="zoomOut" title="Uzaklaştır">−</button>
    <button data-act="zoomIn" title="Yakınlaştır">+</button>
    <input id="findInput" type="search" placeholder="Ara…" />
    <button data-act="findPrev" title="Önceki sonuç">↑</button>
    <button data-act="findNext" title="Sonraki sonuç">↓</button>
    <button data-act="smart" title="Akıllı Panel">🧠</button>
  `;
  el.querySelector<HTMLButtonElement>("[data-act=prev]")!.onclick = () => cb.onNavigate(-1);
  el.querySelector<HTMLButtonElement>("[data-act=next]")!.onclick = () => cb.onNavigate(1);
  el.querySelector<HTMLButtonElement>("[data-act=zoomOut]")!.onclick = () => cb.onZoom(0.85);
  el.querySelector<HTMLButtonElement>("[data-act=zoomIn]")!.onclick = () => cb.onZoom(1.2);
  el.querySelector<HTMLInputElement>("#findInput")!.addEventListener("input", (e) => cb.onFind((e.target as HTMLInputElement).value));
  el.querySelector<HTMLButtonElement>("[data-act=findPrev]")!.onclick = () => cb.onFind((el.querySelector<HTMLInputElement>("#findInput")!.value));
  el.querySelector<HTMLButtonElement>("[data-act=findNext]")!.onclick = () => cb.onFind((el.querySelector<HTMLInputElement>("#findInput")!.value));
  el.querySelector<HTMLButtonElement>("[data-act=smart]")!.onclick = () => cb.onToggleSmartPanel();
  return el;
}

export function updatePageInfo(el: HTMLElement, current: number, total: number): void {
  el.textContent = `${current} / ${total}`;
}
```

- [ ] **Step 2: src/viewer/findBar.ts yaz** (literal + regex arama, text layer span'larını vurgular)

```ts
export interface FindResult {
  pageNumber: number;
  spanIndex: number;
  text: string;
}

interface FindableSpan {
  text: string;
  pageNumber?: number;
}

export function findInSpans(
  spans: FindableSpan[],
  query: string,
  regex = false
): FindResult[] {
  if (!query) return [];
  const results: FindResult[] = [];
  try {
    const re = regex ? new RegExp(query, "gi") : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    spans.forEach((span, idx) => {
      re.lastIndex = 0;
      if (re.test(span.text)) results.push({ pageNumber: span.pageNumber ?? -1, spanIndex: idx, text: span.text });
    });
  } catch {
    return [];
  }
  return results;
}
```
> `pageNumber` çağıran tarafın flatMap ile span'a eklediği alandan gelir (`{ ...s, pageNumber: i + 1 }`); eklenmemişse `-1` kalır (tek başına testte anlamlı). Bu fonksiyon saf ve test edilebilir.

- [ ] **Step 3: viewer.ts'yi toolbar + gezinme + zoom + arama ile genişlet**

```ts
import "./viewer.css";
import { loadDocument } from "./pdfLoader";
import { renderPage, type RenderedPage } from "./pageRenderer";
import { createToolbar, updatePageInfo } from "./toolbar";
import { findInSpans, type FindResult } from "./findBar";

const renderedPages: RenderedPage[] = [];
let currentPage = 1;
let scale = 1.25;
let pdf: import("pdfjs-dist").PDFDocumentProxy;

async function renderAll(): Promise<void> {
  const pages = document.getElementById("pages")!;
  pages.innerHTML = "";
  renderedPages.length = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const container = document.createElement("div");
    container.className = "page-container";
    pages.appendChild(container);
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);
    renderedPages.push(await renderPage(page, canvas, container, scale));
    page.cleanup();
  }
  updatePageInfo(document.getElementById("pageInfo")!, currentPage, pdf.numPages);
}

function scrollToPage(n: number): void {
  const pages = document.getElementById("pages")!;
  const target = pages.children[n - 1] as HTMLElement | undefined;
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function init(): Promise<void> {
  const file = getFileParam();
  const app = document.getElementById("app")!;
  app.appendChild(
    createToolbar({
      onNavigate: (delta) => { const n = Math.min(Math.max(currentPage + delta, 1), pdf.numPages); currentPage = n; scrollToPage(n); },
      onZoom: async (f) => { scale = Math.min(Math.max(scale * f, 0.5), 4); await renderAll(); scrollToPage(currentPage); },
      onFind: (q) => { const results = findInSpans(renderedPages.flatMap((r, i) => r.textSpans.map((s) => ({ ...s, pageNumber: i + 1 }))), q); },
      onToggleSmartPanel: () => { document.getElementById("smartPanel")?.classList.toggle("open"); },
    })
  );
  const pages = document.createElement("div");
  pages.id = "pages";
  app.appendChild(pages);

  pdf = await loadDocument(file);
  document.getElementById("title")!.textContent = file.split("/").pop() || file;
  await renderAll();
}

function getFileParam(): string {
  const url = new URL(location.href);
  const file = url.searchParams.get("file");
  return file ? decodeURIComponent(file) : "";
}

void init();
```
> Not: `FindResult.pageNumber` — `renderedPages.flatMap` ile sayfa numarası doldurulur; vurgulama görsel katmanı Task 10'da eklenir.

- [ ] **Step 4: tests/unit/findBar.test.ts yaz**

```ts
import { describe, expect, it } from "vitest";
import { findInSpans } from "../../src/viewer/findBar";

describe("findInSpans", () => {
  const spans = [{ text: "Vergi dairesi" }, { text: "Tutar: 1200 TL" }, { text: "vergi" }];
  it("finds literal matches case-insensitively", () => {
    const r = findInSpans(spans, "vergi");
    expect(r.length).toBe(2);
  });
  it("supports regex when flag is set", () => {
    const r = findInSpans(spans, "Tutar[^\\d]*(\\d+)", true);
    expect(r.length).toBe(1);
  });
  it("returns empty for empty query", () => {
    expect(findInSpans(spans, "")).toEqual([]);
  });
  it("treats invalid regex as no results", () => {
    expect(findInSpans(spans, "(", true)).toEqual([]);
  });
});
```

- [ ] **Step 5: test + build + typecheck**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS, hatasız.

- [ ] **Step 6: Commit**

```bash
git add src/viewer tests/unit/findBar.test.ts
git commit -m "feat: add viewer toolbar, navigation, zoom and literal search"
```

---

### Task 7: Akıllı Motor — korpus üretimi (text layer birleştirme)

**Files:**
- Create: `src/engine/text/corpus.ts`
- Create: `src/engine/text/merge.ts`
- Test: `tests/unit/corpus.test.ts`

**Interfaces:**
- Consumes: `PageText` (Task 2)
- Produces: `buildCorpusFromPages(pages: PageText[]): DocumentCorpus`, `mergeTextAndOcr(textLayer: PageText[], ocr: PageText[]): PageText[]` — aynı sayfa için OCR çıktısı varsa text layer'ı tamamlar (boş sayfaları doldurur).

- [ ] **Step 1: src/engine/text/corpus.ts yaz**

```ts
import type { DocumentCorpus, PageText } from "../../shared/types";

export function buildCorpusFromPages(pages: PageText[]): DocumentCorpus {
  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  return {
    pages: sorted,
    fullText: sorted.map((p) => p.text).join("\n\n"),
  };
}

export function corpusHasText(corpus: DocumentCorpus): boolean {
  return corpus.fullText.trim().length > 0;
}
```

- [ ] **Step 2: src/engine/text/merge.ts yaz**

```ts
import type { PageText } from "../../shared/types";

export function mergeTextAndOcr(textLayer: PageText[], ocr: PageText[]): PageText[] {
  const ocrByPage = new Map(ocr.map((p) => [p.pageNumber, p]));
  const out: PageText[] = [];
  for (const page of textLayer) {
    const ocrPage = ocrByPage.get(page.pageNumber);
    if (page.text.trim().length === 0 && ocrPage && ocrPage.text.trim().length > 0) {
      out.push({ ...ocrPage, source: "ocr" });
    } else {
      out.push(page);
    }
  }
  for (const p of ocr) {
    if (!textLayer.some((t) => t.pageNumber === p.pageNumber)) out.push(p);
  }
  return out.sort((a, b) => a.pageNumber - b.pageNumber);
}
```

- [ ] **Step 3: tests/unit/corpus.test.ts yaz**

```ts
import { describe, expect, it } from "vitest";
import { buildCorpusFromPages, corpusHasText } from "../../src/engine/text/corpus";
import { mergeTextAndOcr } from "../../src/engine/text/merge";
import type { PageText } from "../../src/shared/types";

function page(n: number, text: string): PageText {
  return { pageNumber: n, text, spans: text.split(/\s+/).filter(Boolean).map((t) => ({ text: t })), source: "textlayer" };
}

describe("corpus", () => {
  it("sorts pages and joins full text", () => {
    const c = buildCorpusFromPages([page(2, "iki"), page(1, "bir")]);
    expect(c.pages[0].pageNumber).toBe(1);
    expect(c.fullText).toBe("bir\n\niki");
  });
  it("detects empty corpus", () => {
    expect(corpusHasText(buildCorpusFromPages([]))).toBe(false);
  });
  it("merge fills empty textlayer pages from ocr", () => {
    const merged = mergeTextAndOcr([page(1, "dijital"), page(2, "")], [page(2, "taranmış")]);
    expect(merged.find((p) => p.pageNumber === 2)!.text).toBe("taranmış");
    expect(merged.find((p) => p.pageNumber === 2)!.source).toBe("ocr");
  });
  it("merge keeps digital text when ocr also exists", () => {
    const merged = mergeTextAndOcr([page(1, "dijital")], [page(1, "ocr çıktısı")]);
    expect(merged.find((p) => p.pageNumber === 1)!.text).toBe("dijital");
  });
});
```

- [ ] **Step 4: test + typecheck + build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine tests/unit/corpus.test.ts
git commit -m "feat: build unified document corpus from text layer and OCR"
```

---

### Task 8: Akıllı Motor — OCR modülü (Tesseract.js)

**Files:**
- Create: `src/engine/ocr/ocr.ts`
- Test: `tests/unit/ocr.test.ts`

**Interfaces:**
- Consumes: Tesseract `createWorker`; `Bbox` (Task 2)
- Produces: `class OcrEngine { init(): Promise<void>; recognizePage(canvas: HTMLCanvasElement, pageNumber: number): Promise<PageText>; setProgress(cb: (p: number) => void): void; terminate(): Promise<void> }` — `langPath` = `chrome.runtime.getURL("models/tessdata")`, worker/core `node_modules`'tan kopyalanan dosyalara (build sonrası `dist/` içinde) işaret eder.

- [ ] **Step 1: src/engine/ocr/ocr.ts yaz**

```ts
import { createWorker, type Worker } from "tesseract.js";
import type { Bbox, PageText, TextSpan } from "../../shared/types";

export interface OcrOptions {
  langPath: string;
  corePath: string;
  workerPath: string;
  lang: string;
}

export class OcrEngine {
  private worker: Worker | null = null;
  private progressCb: ((p: number) => void) | null = null;
  private options: OcrOptions;

  constructor(options: OcrOptions) {
    this.options = options;
  }

  setProgress(cb: (p: number) => void): void {
    this.progressCb = cb;
  }

  async init(): Promise<void> {
    this.worker = await createWorker(this.options.lang, 1, {
      langPath: this.options.langPath,
      corePath: this.options.corePath,
      workerPath: this.options.workerPath,
      logger: (m) => {
        if (m.status === "recognizing text" && this.progressCb) {
          this.progressCb(m.progress);
        }
      },
    });
  }

  async recognizePage(canvas: HTMLCanvasElement, pageNumber: number): Promise<PageText> {
    if (!this.worker) throw new Error("OcrEngine not initialized");
    const { data } = await this.worker.recognize(canvas, {}, { text: true, blocks: true });
    const spans: TextSpan[] = [];
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        for (const line of para.lines ?? []) {
          for (const word of line.words ?? []) {
            const b = word.bbox as Bbox;
            spans.push({ text: word.text, bbox: b, confidence: word.confidence });
          }
        }
      }
    }
    return {
      pageNumber,
      text: data.text,
      spans,
      source: "ocr",
    };
  }

  async terminate(): Promise<void> {
    await this.worker?.terminate();
    this.worker = null;
  }
}
```

- [ ] **Step 2: OCR dosyalarını build'e kopyala** — `scripts/copy-static.mjs`'ye tesseract worker + core dosyalarını ekle

Modify `scripts/copy-static.mjs`:
```js
const tessDir = resolve(root, "node_modules/tesseract.js/dist");
if (existsSync(tessDir)) cpSync(tessDir, resolve(dist, "tesseract"), { recursive: true });
const coreDir = resolve(root, "node_modules/tesseract.js-core");
if (existsSync(coreDir)) cpSync(coreDir, resolve(dist, "tesseract-core"), { recursive: true });
```
`chrome.runtime.getURL` ile erişim için `manifest.json` `web_accessible_resources`'a `"tesseract/*"`, `"tesseract-core/*"` ekle.

- [ ] **Step 3: tests/unit/ocr.test.ts yaz** — worker mock'lu (gerçek OCR CI'da yavaş/kırılgan; mantığı test et)

```ts
import { describe, expect, it, vi } from "vitest";
import { OcrEngine } from "../../src/engine/ocr/ocr";

vi.mock("tesseract.js", () => {
  const recognize = vi.fn().mockResolvedValue({
    data: {
      text: "FATURA\nNo: 123",
      blocks: [
        {
          paragraphs: [
            { lines: [{ words: [{ text: "FATURA", bbox: { x0: 1, y0: 1, x1: 9, y1: 5 }, confidence: 0.9 }] }] },
          ],
        },
      ],
    },
  });
  return {
    createWorker: vi.fn().mockResolvedValue({ recognize, terminate: vi.fn().mockResolvedValue(undefined) }),
  };
});

describe("OcrEngine", () => {
  it("recognizes a page into PageText with spans", async () => {
    const engine = new OcrEngine({ langPath: "/", corePath: "/", workerPath: "/", lang: "tur" });
    await engine.init();
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const out = await engine.recognizePage(canvas, 1);
    expect(out.source).toBe("ocr");
    expect(out.pageNumber).toBe(1);
    expect(out.text).toContain("FATURA");
    expect(out.spans[0].bbox).toEqual({ x0: 1, y0: 1, x1: 9, y1: 5 });
  });
  it("throws when not initialized", async () => {
    const engine = new OcrEngine({ langPath: "/", corePath: "/", workerPath: "/", lang: "tur" });
    await expect(engine.recognizePage({} as HTMLCanvasElement, 1)).rejects.toThrow("not initialized");
  });
});
```

- [ ] **Step 4: test + typecheck + build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/ocr scripts/copy-static.mjs public/manifest.json tests/unit/ocr.test.ts
git commit -m "feat: add local OCR engine with tesseract.js"
```

---

### Task 9: Akıllı Motor — anlamsal arama (transformers.js embedding)

**Files:**
- Create: `src/engine/search/semantic.ts`
- Test: `tests/unit/semantic.test.ts`

**Interfaces:**
- Consumes: `pipeline("feature-extraction", ...)`; `DocumentCorpus`, `SearchResult` (Task 2)
- Produces: `class SemanticSearch { init(): Promise<void>; index(corpus: DocumentCorpus): Promise<void>; search(query: string, topK?: number): Promise<SearchResult[]> }` — cümle bazlı embedding, cosine benzerliği.

- [ ] **Step 1: src/engine/search/semantic.ts yaz**

```ts
import { pipeline } from "@huggingface/transformers";
import type { DocumentCorpus, SearchResult, TextSpan } from "../../shared/types";

const MODEL = "Xenova/all-MiniLM-L6-v2";

type FeatureExtractionPipeline = (texts: string[], opts?: { pooling?: string; normalize?: boolean }) => Promise<{ tolist(): number[][] }>;

interface IndexedSentence {
  pageNumber: number;
  spanIndex: number;
  text: string;
  embedding: number[];
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export class SemanticSearch {
  private extractor: FeatureExtractionPipeline | null = null;
  private index: IndexedSentence[] = [];

  async init(): Promise<void> {
    this.extractor = (await pipeline("feature-extraction", MODEL, { dtype: "q8" })) as unknown as FeatureExtractionPipeline;
  }

  async index(corpus: DocumentCorpus): Promise<void> {
    if (!this.extractor) throw new Error("SemanticSearch not initialized");
    this.index = [];
    const sentences: { pageNumber: number; spanIndex: number; text: string }[] = [];
    for (const page of corpus.pages) {
      page.spans.forEach((span, i) => {
        const t = span.text.trim();
        if (t.length > 1) sentences.push({ pageNumber: page.pageNumber, spanIndex: i, text: t });
      });
    }
    if (!sentences.length) return;
    const chunks: string[][] = [];
    for (let i = 0; i < sentences.length; i += 64) {
      chunks.push(sentences.slice(i, i + 64).map((s) => s.text));
    }
    for (let c = 0; c < chunks.length; c++) {
      const out = await this.extractor!(chunks[c], { pooling: "mean", normalize: true });
      const rows = out.tolist();
      rows.forEach((emb, j) => {
        const s = sentences[c * 64 + j];
        this.index.push({ pageNumber: s.pageNumber, spanIndex: s.spanIndex, text: s.text, embedding: emb });
      });
    }
  }

  async search(query: string, topK = 5): Promise<SearchResult[]> {
    if (!this.extractor) throw new Error("SemanticSearch not initialized");
    if (!this.index.length) return [];
    const [qEmb] = (await this.extractor([query], { pooling: "mean", normalize: true })).tolist();
    const scored = this.index
      .map((s) => ({ ...s, score: cosine(qEmb, s.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return scored.map((s): SearchResult => ({
      pageNumber: s.pageNumber,
      spanIndex: s.spanIndex,
      span: { text: s.text } as TextSpan,
      score: s.score,
      kind: "semantic",
    }));
  }
}
```

- [ ] **Step 2: tests/unit/semantic.test.ts yaz** — pipeline mock'lu (deterministik embedding)

```ts
import { describe, expect, it, vi } from "vitest";
import type { DocumentCorpus } from "../../src/shared/types";
import { SemanticSearch } from "../../src/engine/search/semantic";

function emb(v: number): number[] {
  return Array.from({ length: 8 }, () => v);
}

vi.mock("@huggingface/transformers", () => {
  const extractor = vi.fn(async (texts: string[]) => ({
    tolist: () => texts.map((t: string) => emb(t.includes("vergi") ? 1 : 0)),
  }));
  return { pipeline: vi.fn().mockResolvedValue(extractor) };
});

describe("SemanticSearch", () => {
  it("returns ranked results matching the query", async () => {
    const corpus: DocumentCorpus = {
      pages: [
        {
          pageNumber: 1,
          text: "vergi dairesi",
          spans: [{ text: "vergi dairesi" }],
          source: "textlayer",
        },
        { pageNumber: 2, text: "market alışverişi", spans: [{ text: "market alışverişi" }], source: "textlayer" },
      ],
      fullText: "vergi dairesi\n\nmarket alışverişi",
    };
    const s = new SemanticSearch();
    await s.init();
    await s.index(corpus);
    const results = await s.search("vergi");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].pageNumber).toBe(1);
  });
  it("returns empty for unindexed corpus", async () => {
    const s = new SemanticSearch();
    await s.init();
    expect(await s.search("x")).toEqual([]);
  });
});
```

- [ ] **Step 3: test + typecheck + build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/engine/search tests/unit/semantic.test.ts
git commit -m "feat: add local semantic search with transformers.js embeddings"
```

---

### Task 10: Viewer — highlight katmanı + arama vurgulama + Akıllı Panel taslağı

**Files:**
- Create: `src/viewer/highlight.ts`
- Create: `src/viewer/smartPanel.ts`
- Modify: `src/viewer/viewer.ts`
- Modify: `src/viewer/viewer.css`
- Test: `tests/unit/highlight.test.ts`

**Interfaces:**
- Consumes: `findInSpans` (Task 6), `SearchResult` (Task 2)
- Produces: `highlightSpans(container, matches: { spanIndex, pageNumber }[])`, `createSmartPanel(): HTMLElement` (OCR durumu, anlamsal arama, özet, çıkarma sekmeleri — Task 11-14'te doldurulur).

- [ ] **Step 1: src/viewer/highlight.ts yaz**

```ts
import type { SearchResult } from "../shared/types";

export interface TextSpanRef {
  pageNumber: number;
  spanIndex: number;
}

export function highlightSpans(containers: HTMLElement[], refs: TextSpanRef[]): number {
  for (const el of containers) el.classList.remove("pdfe-highlight");
  const pageEls = containers.map((el) => el.querySelectorAll(".textLayer span"));
  let count = 0;
  for (const ref of refs) {
    const spans = pageEls[ref.pageNumber - 1];
    const span = spans?.[ref.spanIndex] as HTMLElement | undefined;
    if (span) {
      span.classList.add("pdfe-highlight");
      count++;
    }
  }
  return count;
}

export function searchResultsToRefs(results: SearchResult[]): TextSpanRef[] {
  return results.map((r) => ({ pageNumber: r.pageNumber, spanIndex: r.spanIndex }));
}
```

- [ ] **Step 2: src/viewer/smartPanel.ts yaz** (iskelet — sekme yapısı, içerik Task 12-14)

```ts
export function createSmartPanel(): HTMLElement {
  const panel = document.createElement("aside");
  panel.id = "smartPanel";
  panel.innerHTML = `
    <nav>
      <button data-tab="ocr" class="active">OCR</button>
      <button data-tab="search">Akıllı Arama</button>
      <button data-tab="summary">Özet</button>
      <button data-tab="extract">Veri</button>
    </nav>
    <section id="tab-ocr"></section>
    <section id="tab-search" hidden></section>
    <section id="tab-summary" hidden></section>
    <section id="tab-extract" hidden></section>
  `;
  panel.querySelectorAll<HTMLButtonElement>("nav button").forEach((btn) => {
    btn.onclick = () => {
      panel.querySelectorAll("nav button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      panel.querySelectorAll("section").forEach((s) => (s.hidden = true));
      panel.querySelector(`#tab-${btn.dataset.tab}`)!.hidden = false;
    };
  });
  return panel;
}
```

- [ ] **Step 3: viewer.css'ye highlight + panel stilleri ekle**

```css
.textLayer span.pdfe-highlight { background: rgba(255, 200, 0, .5); }
#smartPanel { position: fixed; top: 48px; right: 0; bottom: 0; width: 340px; background: #1f1f1f; border-left: 1px solid #444; transform: translateX(100%); transition: transform .2s; display: flex; flex-direction: column; z-index: 10; }
#smartPanel.open { transform: translateX(0); }
#smartPanel nav { display: flex; }
#smartPanel nav button { flex: 1; padding: 8px; background: none; color: #ccc; border: none; cursor: pointer; }
#smartPanel nav button.active { background: #333; color: #fff; }
#smartPanel section { padding: 12px; overflow: auto; flex: 1; }
```

- [ ] **Step 4: viewer.ts'ye highlight + smart panel bağla**

Modify `src/viewer/viewer.ts`: `onFind` callback'ini arama yapıp `highlightSpans` ile vurgulayacak şekilde, `onToggleSmartPanel` ile panel'i `open` toggle'layacak şekilde düzenle. Her sayfa render edilirken `renderedPages[i]` yanında `.textLayer` referansını sakla (ör. `renderedLayers: HTMLElement[]`).

```ts
// viewer.ts içine:
import { highlightSpans } from "./highlight";
import { createSmartPanel } from "./smartPanel";

const renderedLayers: HTMLElement[] = [];

// renderAll içinde renderPage sonrası:
renderedLayers.push(container.querySelector(".textLayer")!);

// onFind içinde:
const results = findInSpans(renderedPages.flatMap((r, i) => r.textSpans.map((s) => ({ ...s, pageNumber: i + 1 }))), q);
const refs = results.map((r) => ({ pageNumber: r.pageNumber, spanIndex: r.spanIndex }));
highlightSpans(renderedLayers, refs);

// init içinde app.appendChild(createSmartPanel())
```

- [ ] **Step 5: tests/unit/highlight.test.ts yaz** (jsdom)

```ts
import { describe, expect, it } from "vitest";
import { searchResultsToRefs } from "../../src/viewer/highlight";

describe("highlight", () => {
  it("converts search results to refs", () => {
    const refs = searchResultsToRefs([
      { pageNumber: 2, spanIndex: 3, span: { text: "x" }, score: 0.5, kind: "semantic" },
    ]);
    expect(refs).toEqual([{ pageNumber: 2, spanIndex: 3 }]);
  });
});
```
> `highlightSpans` DOM'a dokunduğundan jsdom'da container'lar olmadan davranışı test etmek zahmetli; bu görevde saf dönüşüm testi yeterli, DOM davranışı e2e'de (Task 17) doğrulanır.

- [ ] **Step 6: test + build + typecheck**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/viewer tests/unit/highlight.test.ts
git commit -m "feat: add search highlighting and smart panel scaffold"
```

---

### Task 11: Akıllı Motor — pipeline orkestrasyonu (OCR + korpus + index)

**Files:**
- Create: `src/engine/pipeline.ts`
- Test: `tests/unit/pipeline.test.ts`

**Interfaces:**
- Consumes: `OcrEngine` (Task 8), `SemanticSearch` (Task 9), `buildCorpusFromPages`/`mergeTextAndOcr` (Task 7)
- Produces: `class EnginePipeline { setState(cb: (s: EngineState) => void); run(pages: PDFPageProxy[], opts: { scale: number }): Promise<DocumentCorpus>; search(q): Promise<SearchResult[]>; }` — dijital metin korpusunu kurar, boş sayfaları OCR ile doldurur, embedding index'ler; durum callback'iyle UI'ya `EngineState` bildirir.

- [ ] **Step 1: src/engine/pipeline.ts yaz**

```ts
import type { PDFPageProxy } from "pdfjs-dist";
import type { DocumentCorpus, EngineState, PageText, SearchResult } from "../shared/types";
import { buildCorpusFromPages, corpusHasText } from "./text/corpus";
import { mergeTextAndOcr } from "./text/merge";
import { OcrEngine } from "./ocr/ocr";
import { SemanticSearch } from "./search/semantic";

export interface PipelineDeps {
  ocr: OcrEngine;
  semantic: SemanticSearch;
  ocrLangPath: string;
  ocrCorePath: string;
  ocrWorkerPath: string;
}

export class EnginePipeline {
  private corpus: DocumentCorpus | null = null;
  private stateCb: ((s: EngineState) => void) | null = null;
  private deps: PipelineDeps;

  constructor(deps: PipelineDeps) {
    this.deps = deps;
  }

  setState(cb: (s: EngineState) => void): void {
    this.stateCb = cb;
  }

  private emit(s: Partial<EngineState>): void {
    this.stateCb?.({ ocr: "idle", ocrProgress: 0, corpusReady: false, searchReady: false, ...s });
  }

  async run(pages: PDFPageProxy[], opts: { scale: number }): Promise<DocumentCorpus> {
    this.emit({ ocr: "idle", ocrProgress: 0 });

    const textLayerPages: PageText[] = [];
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const textContent = await page.getTextContent();
      const spans = textContent.items
        .filter((it: any) => typeof it.str === "string" && it.str.trim())
        .map((it: any) => ({ text: it.str as string }));
      textLayerPages.push({
        pageNumber: i + 1,
        text: spans.map((s) => s.text).join(" "),
        spans,
        source: "textlayer",
      });
    }

    const preliminary = buildCorpusFromPages(textLayerPages);
    let finalPages = textLayerPages;

    if (!corpusHasText(preliminary)) {
      this.emit({ ocr: "loading", ocrProgress: 0.05 });
      await this.deps.ocr.init();
      const ocrPages: PageText[] = [];
      for (let i = 0; i < pages.length; i++) {
        const canvas = document.createElement("canvas");
        const viewport = pages[i].getViewport({ scale: opts.scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await pages[i].render({ canvasContext: ctx, viewport }).promise;
        const out = await this.deps.ocr.recognizePage(canvas, i + 1);
        ocrPages.push(out);
        this.emit({ ocr: "running", ocrProgress: (i + 1) / pages.length });
      }
      await this.deps.ocr.terminate();
      finalPages = mergeTextAndOcr(textLayerPages, ocrPages);
    }

    const corpus = buildCorpusFromPages(finalPages);
    this.corpus = corpus;
    this.emit({ ocr: "done", ocrProgress: 1, corpusReady: true });

    if (corpusHasText(corpus)) {
      await this.deps.semantic.init();
      await this.deps.semantic.index(corpus);
      this.emit({ searchReady: true });
    }
    return corpus;
  }

  async search(query: string): Promise<SearchResult[]> {
    if (!this.corpus) return [];
    return this.deps.semantic.search(query);
  }
}
```

- [ ] **Step 2: tests/unit/pipeline.test.ts yaz**

```ts
import { describe, expect, it, vi } from "vitest";
import { EnginePipeline } from "../../src/engine/pipeline";
import { OcrEngine } from "../../src/engine/ocr/ocr";
import { SemanticSearch } from "../../src/engine/search/semantic";
import type { DocumentCorpus, PageText } from "../../src/shared/types";

function mockPage(text: string): any {
  return {
    getTextContent: vi.fn().mockResolvedValue({
      items: text.split(/\s+/).filter(Boolean).map((s) => ({ str: s })),
    }),
    getViewport: vi.fn().mockReturnValue({ width: 100, height: 200, scale: 1 }),
    render: vi.fn().mockResolvedValue({ promise: Promise.resolve() }),
  };
}

function fakeOcr(): OcrEngine {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    recognizePage: vi.fn().mockImplementation(async (_c, n) => ({ pageNumber: n, text: `ocr${n}`, spans: [], source: "ocr" }) as PageText),
    terminate: vi.fn().mockResolvedValue(undefined),
    setProgress: vi.fn(),
  } as unknown as OcrEngine;
}

function fakeSemantic(): SemanticSearch {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    index: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
  } as unknown as SemanticSearch;
}

describe("EnginePipeline", () => {
  it("builds corpus from digital text without OCR", async () => {
    const pipeline = new EnginePipeline({
      ocr: fakeOcr(),
      semantic: fakeSemantic(),
      ocrLangPath: "/", ocrCorePath: "/", ocrWorkerPath: "/",
    });
    const states: any[] = [];
    pipeline.setState((s) => states.push(s));
    const corpus = await pipeline.run([mockPage("merhaba dunya")], { scale: 1 });
    expect(corpus.fullText).toContain("merhaba");
    expect((pipeline as any).deps.ocr.init).not.toHaveBeenCalled();
    expect(states.some((s) => s.corpusReady)).toBe(true);
  });

  it("falls back to OCR when text is empty", async () => {
    const ocr = fakeOcr();
    const pipeline = new EnginePipeline({
      ocr,
      semantic: fakeSemantic(),
      ocrLangPath: "/", ocrCorePath: "/", ocrWorkerPath: "/",
    });
    const corpus = await pipeline.run([mockPage("   ") as any], { scale: 1 });
    expect(ocr.init).toHaveBeenCalled();
    expect(corpus.fullText).toContain("ocr1");
  });
});
```
> Not: `document.createElement` jsdom'da mevcuttur. `mockPage(" ")` metinsiz; `spans` boş olur, `preliminary.fullText` boş → OCR yolu tetiklenir.

- [ ] **Step 3: test + typecheck + build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/engine/pipeline.ts tests/unit/pipeline.test.ts
git commit -m "feat: orchestrate OCR, corpus and semantic index in pipeline"
```

---

### Task 12: Akıllı Panel — OCR durumu + anlamsal arama UI

**Files:**
- Modify: `src/viewer/smartPanel.ts`
- Modify: `src/viewer/viewer.ts`
- Modify: `src/viewer/viewer.css`
- Test: `tests/unit/smartPanel.test.ts`

**Interfaces:**
- Consumes: `EnginePipeline` (Task 11), `SearchResult` (Task 2)
- Produces: `bindSmartPanel(panel, { pipeline, onHighlight }): { setState(s): void; }` — OCR ilerleme çubuğu, anlamsal arama kutusu, sonuç listesi; her sonuç tıklanınca `onHighlight(pageNumber)` çağrılır.

- [ ] **Step 1: smartPanel.ts'yi işlevsel hale getir**

```ts
import type { EngineState, SearchResult } from "../shared/types";
import type { EnginePipeline } from "../engine/pipeline";

export interface SmartPanelCallbacks {
  pipeline: EnginePipeline;
  onHighlight: (pageNumber: number) => void;
}

export function createSmartPanel(): HTMLElement {
  const panel = document.createElement("aside");
  panel.id = "smartPanel";
  panel.innerHTML = `
    <nav>
      <button data-tab="ocr" class="active">OCR</button>
      <button data-tab="search">Akıllı Arama</button>
      <button data-tab="summary">Özet</button>
      <button data-tab="extract">Veri</button>
    </nav>
    <section id="tab-ocr">
      <div id="ocrStatus">Hazır</div>
      <div id="ocrProgressWrap" hidden><progress id="ocrProgress" max="1" value="0"></progress></div>
    </section>
    <section id="tab-search" hidden>
      <input id="semanticInput" type="search" placeholder="Anlamlı ara…" />
      <ul id="searchResults"></ul>
    </section>
    <section id="tab-summary" hidden>
      <button id="summarizeBtn">Özetle</button>
      <div id="summaryOutput"></div>
    </section>
    <section id="tab-extract" hidden>
      <button id="extractBtn">Verileri Çıkar</button>
      <div id="extractOutput"></div>
    </section>
  `;
  panel.querySelectorAll<HTMLButtonElement>("nav button").forEach((btn) => {
    btn.onclick = () => {
      panel.querySelectorAll("nav button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      panel.querySelectorAll("section").forEach((s) => (s.hidden = true));
      panel.querySelector(`#tab-${btn.dataset.tab}`)!.hidden = false;
    };
  });
  return panel;
}

export function bindSmartPanel(panel: HTMLElement, cb: SmartPanelCallbacks): { setState(s: EngineState): void } {
  const status = panel.querySelector<HTMLElement>("#ocrStatus")!;
  const progressWrap = panel.querySelector<HTMLElement>("#ocrProgressWrap")!;
  const progress = panel.querySelector<HTMLProgressElement>("#ocrProgress")!;
  const input = panel.querySelector<HTMLInputElement>("#semanticInput")!;
  const resultsEl = panel.querySelector<HTMLElement>("#searchResults")!;

  let timer: ReturnType<typeof setTimeout> | undefined;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) return;
    timer = setTimeout(async () => {
      const results = await cb.pipeline.search(q);
      renderResults(results);
    }, 300);
  });

  function renderResults(results: SearchResult[]): void {
    resultsEl.innerHTML = "";
    for (const r of results) {
      const li = document.createElement("li");
      li.textContent = `${r.pageNumber}. sayfa — ${r.span.text.slice(0, 60)}`;
      li.onclick = () => cb.onHighlight(r.pageNumber);
      resultsEl.appendChild(li);
    }
  }

  return {
    setState(s: EngineState): void {
      status.textContent =
        s.ocr === "loading" ? "OCR yükleniyor…" :
        s.ocr === "running" ? "OCR çalışıyor…" :
        s.ocr === "done" ? "OCR tamamlandı" :
        s.ocr === "failed" ? "OCR başarısız" : "Hazır";
      progressWrap.hidden = s.ocr !== "running";
      progress.value = s.ocrProgress;
    },
  };
}
```

- [ ] **Step 2: viewer.ts'ye pipeline + panel bağla**

Modify `src/viewer/viewer.ts`:
- `EnginePipeline` oluştur (`ocr`, `semantic` örnekleri `chrome.runtime.getURL` yollarıyla)
- `pipeline.setState` → `panelApi.setState`
- `run(pdf.pages..., { scale })` — `pdf.getPage` döngüsüyle tüm sayfaları al
- `onHighlight(pageNumber)` → `scrollToPage`
- "Özetle" ve "Verileri Çıkar" butonları Task 13/14'te dolar; bu görevde yalnızca OCR + arama canlıdır.

- [ ] **Step 3: smartPanel.test.ts yaz** (DOM'daki setState davranışı)

```ts
import { describe, expect, it, vi } from "vitest";
import { bindSmartPanel, createSmartPanel } from "../../src/viewer/smartPanel";
import type { EnginePipeline } from "../../src/engine/pipeline";

describe("smartPanel", () => {
  it("renders OCR status text", () => {
    const panel = createSmartPanel();
    const pipeline = { search: vi.fn().mockResolvedValue([]) } as unknown as EnginePipeline;
    const api = bindSmartPanel(panel, { pipeline, onHighlight: () => {} });
    api.setState({ ocr: "running", ocrProgress: 0.5, corpusReady: false, searchReady: false });
    expect(panel.querySelector("#ocrStatus")!.textContent).toContain("OCR çalışıyor");
  });
  it("shows progress bar only while running", () => {
    const panel = createSmartPanel();
    const pipeline = { search: vi.fn().mockResolvedValue([]) } as unknown as EnginePipeline;
    const api = bindSmartPanel(panel, { pipeline, onHighlight: () => {} });
    api.setState({ ocr: "done", ocrProgress: 1, corpusReady: true, searchReady: true });
    expect(panel.querySelector("#ocrProgressWrap")!.hidden).toBe(true);
  });
});
```

- [ ] **Step 4: test + typecheck + build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/viewer tests/unit/smartPanel.test.ts
git commit -m "feat: bind smart panel to pipeline with OCR status and semantic search"
```

---

### Task 13: Akıllı Panel — özetleme

**Files:**
- Create: `src/engine/summarize/summarizer.ts`
- Modify: `src/viewer/smartPanel.ts`
- Test: `tests/unit/summarizer.test.ts`

**Interfaces:**
- Consumes: transformers.js `pipeline("summarization", ...)`
- Produces: `class Summarizer { init(): Promise<void>; summarize(text: string, maxLength?: number): Promise<string> }` — uzun metni map-reduce ile parçalar.

- [ ] **Step 1: src/engine/summarize/summarizer.ts yaz**

```ts
import { pipeline } from "@huggingface/transformers";

const MODEL = "Xenova/distilbart-cnn-6-6";
type SummarizationPipeline = (text: string, opts: { max_length: number; min_length: number }) => Promise<{ summary_text: string }[]>;

const CHUNK_WORDS = 800;

function chunkText(text: string, maxWords: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
  }
  return chunks;
}

export class Summarizer {
  private pipe: SummarizationPipeline | null = null;

  async init(): Promise<void> {
    this.pipe = (await pipeline("summarization", MODEL)) as unknown as SummarizationPipeline;
  }

  async summarize(text: string, maxLength = 120): Promise<string> {
    if (!this.pipe) throw new Error("Summarizer not initialized");
    const chunks = chunkText(text, CHUNK_WORDS);
    if (chunks.length === 0) return "";
    const parts: string[] = [];
    for (const c of chunks) {
      const [out] = await this.pipe(c, { max_length: Math.min(maxLength, 200), min_length: 20 });
      parts.push(out.summary_text);
    }
    return parts.length === 1 ? parts[0] : parts.join(" ");
  }
}
```

- [ ] **Step 2: summarizer.test.ts yaz** (mock)

```ts
import { describe, expect, it, vi } from "vitest";
import { Summarizer } from "../../src/engine/summarize/summarizer";

vi.mock("@huggingface/transformers", () => {
  const pipe = vi.fn(async (_t: string) => [{ summary_text: "özet çıktısı" }]);
  return { pipeline: vi.fn().mockResolvedValue(pipe) };
});

describe("Summarizer", () => {
  it("returns summary for short text", async () => {
    const s = new Summarizer();
    await s.init();
    expect(await s.summarize("bu bir faturanın uzun metnidir")).toBe("özet çıktısı");
  });
  it("returns empty for empty text", async () => {
    const s = new Summarizer();
    await s.init();
    expect(await s.summarize("   ")).toBe("");
  });
});
```

- [ ] **Step 3: smartPanel.ts'ye özet butonu bağla**

Modify `src/viewer/smartPanel.ts`: `SmartPanelCallbacks`'a `summarizer: Summarizer` ekle; `bindSmartPanel` içinde `#summarizeBtn` tıklanınca `summarizer.summarize(corpus.fullText)` çağırıp `#summaryOutput`'a yaz (corpus `pipeline` üzerinden erişilir — `SmartPanelCallbacks`'a `getCorpus: () => DocumentCorpus | null` ekle).

- [ ] **Step 4: test + typecheck + build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/summarize src/viewer/smartPanel.ts tests/unit/summarizer.test.ts
git commit -m "feat: add local summarization with map-reduce chunking"
```

---

### Task 14: Akıllı Panel — veri çıkarma

**Files:**
- Create: `src/engine/extract/extract.ts`
- Create: `src/engine/extract/schemas.ts`
- Modify: `src/viewer/smartPanel.ts`
- Test: `tests/unit/extract.test.ts`

**Interfaces:**
- Consumes: `ExtractionResult`, `ExtractionSchema` (Task 2)
- Produces: `extractFields(corpus: DocumentCorpus, schema: ExtractionSchema): ExtractionResult` — Türkçe fatura şeması (`faturaNo`, `tarih`, `tutar`, `kdv`, `iban`, `tedarikci`).

- [ ] **Step 1: src/engine/extract/schemas.ts yaz**

```ts
import type { ExtractionSchema } from "../../shared/types";

export const INVOICE_SCHEMA: ExtractionSchema = {
  fields: {
    faturaNo: { label: "Fatura No", pattern: "\\b(?:[A-Z]{1,3}\\s?)?\\d{3,10}\\b" },
    tarih: { label: "Tarih", pattern: "\\b\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}\\b" },
    tutar: { label: "Tutar", pattern: "(?:\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+\\.\\d{2})\\s?(?:TL|₺|TRY)?\\b" },
    kdv: { label: "KDV", pattern: "(?:KDV|K.D.V.)\\s*(?:%\\s*)?\\d{1,2}" },
    iban: { label: "IBAN", pattern: "\\bTR\\d{2}\\s?(?:\\d{4}\\s?){5}\\d{2}\\b" },
    tedarikci: { label: "Tedarikçi", pattern: "\\b[A-Z][^\\n,;]{5,60}\\b" },
  },
};

export const GENERAL_SCHEMA: ExtractionSchema = {
  fields: {
    email: { label: "E-posta", pattern: "[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+" },
    telefon: { label: "Telefon", pattern: "(?:\\+90\\s?|0\\s?)?(?:\\d{3}\\s?\\d{3}\\s?\\d{2}\\s?\\d{2}|\\d{10})" },
    tcNo: { label: "TC Kimlik No", pattern: "\\b\\d{11}\\b" },
    tarih: { label: "Tarih", pattern: "\\b\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}\\b" },
  },
};
```

- [ ] **Step 2: src/engine/extract/extract.ts yaz**

```ts
import type { DocumentCorpus, ExtractionResult, ExtractionSchema } from "../../shared/types";

export function extractFields(corpus: DocumentCorpus, schema: ExtractionSchema): ExtractionResult {
  const result: ExtractionResult = {};
  const text = corpus.fullText;
  for (const [key, field] of Object.entries(schema.fields)) {
    try {
      const re = new RegExp(field.pattern, "gi");
      const match = text.match(re);
      result[key] = match ? match[0] : null;
    } catch {
      result[key] = null;
    }
  }
  return result;
}
```

- [ ] **Step 3: tests/unit/extract.test.ts yaz**

```ts
import { describe, expect, it } from "vitest";
import { extractFields } from "../../src/engine/extract/extract";
import { GENERAL_SCHEMA, INVOICE_SCHEMA } from "../../src/engine/extract/schemas";
import type { DocumentCorpus } from "../../src/shared/types";

function corpus(text: string): DocumentCorpus {
  return { pages: [{ pageNumber: 1, text, spans: [], source: "textlayer" }], fullText: text };
}

describe("extractFields", () => {
  it("extracts invoice fields", () => {
    const text = "FATURA No: 2026/0001\nTarih: 15.03.2026\nTutar: 1.250,00 TL\nKDV %20\nIBAN TR12 0001 2003 1234 5678 9012 34\nTedarikçi: Acme Ltd";
    const r = extractFields(corpus(text), INVOICE_SCHEMA);
    expect(r.faturaNo).toMatch(/\d{3,10}/);
    expect(r.tarih).toBe("15.03.2026");
    expect(r.tutar).toBe("1.250,00 TL");
    expect(r.kdv).toContain("20");
    expect(r.iban).toContain("TR12");
    expect(r.tedarikci).toBe("Acme Ltd");
  });
  it("extracts general fields", () => {
    const text = "Mail: ali@ornek.com Tel: 0532 123 45 67 TC: 12345678901";
    const r = extractFields(corpus(text), GENERAL_SCHEMA);
    expect(r.email).toBe("ali@ornek.com");
    expect(r.telefon).toContain("0532");
    expect(r.tcNo).toBe("12345678901");
  });
  it("returns null for missing fields", () => {
    const r = extractFields(corpus("bos"), INVOICE_SCHEMA);
    expect(r.iban).toBeNull();
  });
});
```

- [ ] **Step 4: smartPanel.ts'ye çıkarma butonu bağla**

Modify `src/viewer/smartPanel.ts`: `SmartPanelCallbacks`'a `getCorpus` ekli zaten (Task 13); `#extractBtn` tıklanınca `extractFields(getCorpus()!, INVOICE_SCHEMA)` çağırıp `#extractOutput`'a tablo olarak yaz.

- [ ] **Step 5: test + typecheck + build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/extract src/viewer/smartPanel.ts tests/unit/extract.test.ts
git commit -m "feat: add template-based data extraction for invoices and general fields"
```

---

### Task 15: Model dosyaları paketleme + çevrimdışı garanti

**Files:**
- Create: `scripts/fetch-models.mjs`
- Create: `public/models/tessdata/README.md`
- Modify: `package.json` (postinstall / build hook)
- Modify: `docs/` (MODEL_LICENSES.md)
- Test: build sonrası `dist/models` kontrolü

**Interfaces:**
- Consumes: —
- Produces: `npm run fetch:models` → `public/models/` içine `tessdata/tur.traineddata`, `tessdata/eng.traineddata`, `onnx/` (embedding + özetleme). Build bunları `dist/models/`'e kopyalar (Task 1 copy-static zaten `models/*` kopyalar).

- [ ] **Step 1: scripts/fetch-models.mjs yaz**

```js
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dest = resolve(root, "public/models");
mkdirSync(dest, { recursive: true });

async function download(url, file) {
  const out = resolve(dest, file);
  if (existsSync(out)) { console.log("skip", file); return; }
  mkdirSync(dirname(out), { recursive: true });
  console.log("downloading", file, "...");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(out, buf);
  console.log("saved", file, buf.length, "bytes");
}

const jobs = [
  // tessdata
  ["https://tessdata.projectnaptha.com/4.0.0/tur.traineddata", "tessdata/tur.traineddata"],
  ["https://tessdata.projectnaptha.com/4.0.0/eng.traineddata", "tessdata/eng.traineddata"],
  // transformers.js ONNX modelleri (HuggingFace, Xenova/mixedbread-ai vb.)
  ["https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx", "onnx/embedding/model.onnx"],
  ["https://huggingface.co/Xenova/distilbart-cnn-6-6/resolve/main/onnx/encoder_model_quantized.onnx", "onnx/summarize/encoder.onnx"],
  ["https://huggingface.co/Xenova/distilbart-cnn-6-6/resolve/main/onnx/decoder_model_quantized.onnx", "onnx/summarize/decoder.onnx"],
];

for (const [url, file] of jobs) {
  try { await download(url, file); } catch (e) { console.error("FAILED", file, e.message); }
}
```

> Not: transformers.js `env.localModelPath` model JSON/tokenizer dosyalarını da ister; `fetch-models.mjs` model klasörlerinin tam içeriğini (tokenizer.json, config.json, tokenizer_config.json, vocab) `https://huggingface.co/Xenova/<model>/resolve/main/<file>` kalıbıyla indirmeli. Bu görevde en az ONNX + config + tokenizer indirilir; eksik dosyalar çalışma anında `env.allowRemoteModels=false` ile hata verir — dolayısıyla indirme listesi modelin HF repo file listesiyle eşleşmeli.

- [ ] **Step 2: package.json'a script ekle**

Modify `package.json`:
```json
"scripts": {
  "fetch:models": "node scripts/fetch-models.mjs"
}
```

- [ ] **Step 3: src/engine/runtime.ts yaz** — model yollarını tek yerden çöz

```ts
import { env } from "@huggingface/transformers";

export function configureRuntime(): void {
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.localModelPath = chrome.runtime.getURL("models/onnx/");
}
```
`viewer.ts` içinde `configureRuntime()`'ı ilk satırda çağır.

- [ ] **Step 4: docs/MODEL_LICENSES.md yaz**

```md
# Model Lisansları

| Model | Kaynak | Lisans |
|---|---|---|
| tur.traineddata / eng.traineddata | tessdata.projectnaptha.com (Tesseract) | Apache 2.0 |
| Xenova/all-MiniLM-L6-v2 | Hugging Face | Apache 2.0 |
| Xenova/distilbart-cnn-6-6 | Hugging Face | Apache 2.0 |
```

- [ ] **Step 5: modelleri indir + build ile doğrula**

Run: `npm run fetch:models && npm run build`
Expected: `public/models/` ve ardından `dist/models/` dolu. Hata yok.

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-models.mjs public/models README? src/engine/runtime.ts docs/MODEL_LICENSES.md package.json
git commit -m "feat: bundle offline model files with per-model licensing"
```
> Not: `public/models` içindeki büyük binary dosyalar git'e eklenebilir veya `.gitignore` ile hariç tutulup `npm run fetch:models` ile çekilebilir. Portfolyo repo'sunda ikili dosyaları hariç tutmak önerilir: `public/models/` yerine `.gitignore`'a `public/models/*` ekle ve README'de `npm run fetch:models` talimatını belirt.

---

### Task 16: README, gizlilik politikası, örnek PDF'ler

**Files:**
- Create: `README.md`
- Create: `docs/PRIVACY.md`
- Create: `LICENSE` (Apache 2.0 tam metni)
- Create: `NOTICE` (derleme bilgisi)
- Create: `tests/fixtures/` — iki örnek PDF (biri dijital metinli, biri taranmış/boş text layer)
- Modify: `public/models/.gitignore` (ikili dosyalar için)

**Interfaces:**
- Consumes: —
- Produces: Dokümantasyon + e2e testlerinin kullanacağı fixture PDF'ler. Fixture üretimi için `scripts/make-fixtures.mjs` (pdf-lib veya pdfjs-dist getDocument ile üretilir; en basiti: pdf-lib kullanmadan elle minimal PDF bytes yazmak — aşağıda verilen sabit küçük PDF şablonu). Taranmış PDF fixtüresi: aynı PDF'in text layer'ı boş bırakılarak üretilir.

- [ ] **Step 1: scripts/make-fixtures.mjs yaz** — minimal geçerli iki PDF üretir

```js
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

mkdirSync("tests/fixtures", { recursive: true });

function minimalPdf(text) {
  const objs = [];
  const content = `BT\n${text}\nET`;
  const stream = Buffer.from(content).toString("base64");
  objs.push(`1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`);
  objs.push(`2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`);
  objs.push(`3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj`);
  objs.push(`4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`);
  objs.push(`5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`);
  return `%PDF-1.4\n${objs.join("\n")}\ntrailer << /Root 1 0 R /Size 6 >>\n%%EOF`;
}

// Dijital metinli PDF (text layer dolu)
writeFileSync(resolve("tests/fixtures/digital.pdf"), minimalPdf("Vergi dairesi FATURA No 2026/0001 Tarih 15.03.2026 Tutar 1.250,00 TL"));

// Taranmış PDF: text layer'ı boş — pdfjs-dist textContent boş döner (content stream'i boş)
writeFileSync(resolve("tests/fixtures/scanned.pdf"), minimalPdf(""));
console.log("fixtures written");
```
> Not: `minimalPdf` içinde text olmaması pdfjs-dist'in boş textContent döndürmesini garanti etmez (font/glyph üretimi yoktur — boş BT/ET stream'i boş içerik üretir). Bu fixture OCR yolunu tetiklemek için yeterli kabul edilir; e2e'de OCR gerçek model gerektirdiğinden OCR e2e testi işaretlenip `test.skip` ile atlanır, dijital fixture testi aktif çalışır.

- [ ] **Step 2: README.md yaz** (vizyon, kurulum, build, yükleme, test, lisans, özellikler)

```md
# PDFE — Yerel Akıllı PDF

Tarayıcıda açılan PDF'leri tamamen **yerel** akıllı araçlarla işleyen Chrome eklentisi:
OCR, anlamsal arama, özetleme ve veri çıkarma. Hiçbir içerik cihazdan çıkmaz.

## Özellikler

- pdfjs-dist tabanlı özel viewer (sayfa gezinme, zoom, arama, highlight)
- Yerel OCR (Tesseract.js) — taranmış belgeleri okunur metne çevirir
- Anlamsal arama (transformers.js embedding) — kavramsal eşleşme
- Özetleme (yerel BART modeli)
- Veri çıkarma (fatura: No, tarih, tutar, KDV, IBAN, tedarikçi)

## Kurulum

```bash
npm install
npm run fetch:models   # model dosyalarını indirir (çevrimdışı çalışma için)
npm run build
```

Chrome → `chrome://extensions` → Geliştirici modu → "Paketlenmemiş öğe yükle" → `dist/` klasörünü seç.

## Test

```bash
npm test          # birim testler (vitest)
npm run test:e2e  # e2e (playwright) — eklenti yüklenir, viewer akışı doğrulanır
```

## Lisans
Apache 2.0 — bkz. `LICENSE`. Model ağırlıkları: `docs/MODEL_LICENSES.md`.
```

- [ ] **Step 3: docs/PRIVACY.md yaz**

```md
# Gizlilik Politikası

PDFE tüm işlemleri yerel olarak yapar. Uygulama:

- PDF içeriğini hiçbir sunucuya göndermez.
- Analitik, telemetri veya çerez kullanmaz.
- Model dosyalarını eklenti paketinden yükler (çevrimdışı çalışır).
- Kullanıcı verisi toplamaz, saklamaz, paylaşmaz.

PDF dosyaları yalnızca tarayıcı içinde, eklentinin viewer'ında işlenir.
```

- [ ] **Step 4: public/models/.gitignore yaz**

```
*
!README.md
```

- [ ] **Step 5: LICENSE ve NOTICE yaz** (Apache 2.0 — tam metin için https://www.apache.org/licenses/LICENSE-2.0.txt adresinden indir)

```bash
Invoke-WebRequest -Uri "https://www.apache.org/licenses/LICENSE-2.0.txt" -OutFile "LICENSE"
```

`NOTICE`:
```
PDFE
Copyright 2026 PDFE contributors

PDFE, Apache 2.0 lisansıyla dağıtılmaktadır.
Gömülü üçüncü taraf bileşenlerin lisansları için docs/MODEL_LICENSES.md ve
package.json bağımlılık listesine bakınız.
```

- [ ] **Step 6: fixture üret + test + build**

Run: `node scripts/make-fixtures.mjs && npm run test && npm run build`
Expected: fixtures oluşur, testler PASS.

- [ ] **Step 7: Commit**

```bash
git add README.md docs/PRIVACY.md LICENSE NOTICE scripts/make-fixtures.mjs tests/fixtures public/models/.gitignore
git commit -m "docs: add README, license, privacy policy and test fixtures"
```

---

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
