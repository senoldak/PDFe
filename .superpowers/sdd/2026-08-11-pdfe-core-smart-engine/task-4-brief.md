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