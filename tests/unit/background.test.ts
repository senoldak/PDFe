import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const addListener = () => {};
  globalThis.chrome = {
    runtime: {
      getURL: (p: string) => `chrome-extension://__EXTENSION_ID__/${p}`,
      onInstalled: { addListener },
      onStartup: { addListener },
      onMessage: { addListener },
    },
    webNavigation: { onBeforeNavigate: { addListener } },
  } as any;
});

import { getViewerUrl } from "../../src/background/background";

const BASE = "chrome-extension://__EXTENSION_ID__/viewer.html";

describe("getViewerUrl", () => {
  it("encodes the pdf url as file param", () => {
    const url = getViewerUrl("https://example.com/a.pdf", BASE);
    expect(url).toBe(
      "chrome-extension://__EXTENSION_ID__/viewer.html?file=" + encodeURIComponent("https://example.com/a.pdf")
    );
  });

  it("keeps fragment out of the encoded file param", () => {
    const url = getViewerUrl("https://example.com/a.pdf#page=2", BASE);
    expect(url).toContain("?file=" + encodeURIComponent("https://example.com/a.pdf"));
    expect(url.endsWith("#page=2")).toBe(true);
  });
});