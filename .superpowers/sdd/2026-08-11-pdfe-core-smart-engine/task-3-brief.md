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