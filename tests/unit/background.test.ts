import { describe, expect, it, vi } from "vitest";

import { getViewerUrl, registerRedirectRule } from "../../src/background/background";

const BASE = "chrome-extension://__EXTENSION_ID__/dist/viewer.html";

describe("getViewerUrl", () => {
  it("encodes the pdf url as file param", () => {
    const url = getViewerUrl("https://example.com/a.pdf", BASE);
    expect(url).toBe(BASE + "?file=" + encodeURIComponent("https://example.com/a.pdf"));
  });

  it("keeps fragment out of the encoded file param", () => {
    const url = getViewerUrl("https://example.com/a.pdf#page=2", BASE);
    expect(url).toContain("?file=" + encodeURIComponent("https://example.com/a.pdf"));
    expect(url.endsWith("#page=2")).toBe(true);
  });
});

describe("registerRedirectRule", () => {
  it("registers an allow rule and two redirect rules carrying the viewer url", async () => {
    const updateDynamicRules = vi.mocked(chrome.declarativeNetRequest.updateDynamicRules);
    await registerRedirectRule();
    const call = updateDynamicRules.mock.calls.find(([args]) => Array.isArray(args.addRules));
    expect(call).toBeDefined();
    const { addRules } = call![0];
    expect(addRules).toHaveLength(3);
    expect(addRules!.map((r) => r.id)).toEqual([1, 2, 3]);
    for (const rule of addRules?.filter((r) => r.action.type === "redirect") ?? []) {
      expect(rule.action.redirect?.regexSubstitution).toBe(`${BASE}?file=\\0`);
    }
  });
});