import type { Message } from "../shared/messages";

export function isPdfUrl(url: string): boolean {
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
  const viewerUrl = chrome.runtime.getURL(`dist/viewer.html?file=${encodeURIComponent(url)}&pdfe=embed`);
  iframe.src = viewerUrl;
  iframe.setAttribute("style", "position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483647;");
  document.documentElement.appendChild(iframe);
  document.body.classList.add("pdfe-content");
}

function init(): void {
  const currentUrl = window.location.href;
  if (isPdfUrl(currentUrl) && !currentUrl.includes("pdfe=embed")) {
    window.postMessage({ type: "pdfe:detect-pdf", url: currentUrl }, "*");
  }
  if (detectPdfInDom()) {
    const src = (document.querySelector("embed[type='application/pdf']") as HTMLElement | null)?.getAttribute("src");
    if (src) embedViewer(new URL(src, location.href).href);
  }
}

window.addEventListener("message", (event: MessageEvent<Message>) => {
  if (event.data?.type === "viewer:url") return;
});

if (typeof document !== "undefined") {
  void init();
}
