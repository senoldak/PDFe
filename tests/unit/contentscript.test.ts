import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  globalThis.window = {
    location: { href: "about:blank" },
    postMessage: () => {},
    addEventListener: () => {},
  } as any;
  globalThis.document = {
    contentType: "",
    querySelector: () => null,
    querySelectorAll: () => [],
    documentElement: {},
    body: {},
  } as any;
  globalThis.chrome = {
    runtime: { getURL: (p: string) => `chrome-extension://__EXTENSION_ID__/${p}` },
    extension: { isAllowedFileSchemeAccess: (() => {}) as any },
  } as any;
});

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
