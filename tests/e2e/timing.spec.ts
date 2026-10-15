import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function launchExtension(): Promise<{ ctx: BrowserContext; extensionId: string }> {
  const extensionPath = path.resolve(".");
  const ctx = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--allow-file-access-from-files",
    ],
  });
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
  const extensionId = new URL(sw.url()).host;
  return { ctx, extensionId };
}

test("timing: model init + semantic search latency", async () => {
  const { ctx, extensionId } = await launchExtension();
  const fileUrl = pathToFileURL(path.resolve("tests/fixtures/digital.pdf")).href;
  const page = await ctx.newPage();
  const sw = performance.now();
  await page.goto(`chrome-extension://${extensionId}/dist/viewer.html?file=${encodeURIComponent(fileUrl)}`);
  console.log(`page.goto (parse+load): ${Math.round(performance.now() - sw)}ms`);

  const t0 = performance.now();
  await page.locator("#corpusStatus", { hasText: "hazır" }).first().waitFor({ state: "visible", timeout: 60_000 });
  console.log(`corpus defensive: ${Math.round(performance.now() - t0)}ms`);

  await page.locator("#searchIndexStatus", { hasText: "hazır" }).first().waitFor({ state: "visible", timeout: 60_000 });
  console.log(`search index ready: ${Math.round(performance.now() - t0)}ms`);

  const input = page.locator("#semanticInput");
  await input.click();
  const t1 = performance.now();
  await input.type("invoice");
  await page.waitForTimeout(500);
  console.log(`typed 7 chars + 500ms wait: ${Math.round(performance.now() - t1)}ms`);

  await page.locator("#searchResults li").first().waitFor({ state: "visible", timeout: 15_000 });
  console.log(`first result appeared: ${Math.round(performance.now() - t1)}ms`);

  await ctx.close();
  void expect(true).toBe(true);
});