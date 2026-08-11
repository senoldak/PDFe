import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function launchExtension(): Promise<{ ctx: BrowserContext; extensionId: string }> {
  const extensionPath = path.resolve("dist");
  const ctx = await chromium.launchPersistentContext("", {
    channel: "chromium",
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

test.describe("PDFE extension", () => {
  test("loads the extension and renders a digital pdf", async () => {
    const { ctx, extensionId } = await launchExtension();
    const fileUrl = pathToFileURL(path.resolve("tests/fixtures/digital.pdf")).href;
    const page = await ctx.newPage();
    await page.goto(`chrome-extension://${extensionId}/viewer.html?file=${encodeURIComponent(fileUrl)}`);
    await expect(page.locator(".textLayer span").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#pageInfo")).toHaveText("1 / 1");
    await ctx.close();
  });
});