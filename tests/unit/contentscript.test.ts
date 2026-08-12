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