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