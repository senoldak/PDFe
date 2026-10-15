const { chromium } = require("@playwright/test");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
(async () => {
  const p = process.cwd();
  const ctx = await chromium.launchPersistentContext("", {
    channel: "chromium", headless: true,
    args: [`--disable-extensions-except=${p}`, `--load-extension=${p}`, "--allow-file-access-from-files"],
  });
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
  const id = new URL(sw.url()).host;
  const page = await ctx.newPage();
  page.on("console", (m) => console.log("CONSOLE[" + m.type() + "]", m.text().slice(0, 300)));
  page.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 400)));
  const f = pathToFileURL(path.resolve("tests/fixtures/digital.pdf")).href;
  const t0 = Date.now();
  await page.goto(`chrome-extension://${id}/dist/viewer.html?file=${encodeURIComponent(f)}`);
  await page.waitForTimeout(25000);
  console.log("ELAPSED", Date.now() - t0);
  const st = await page.evaluate(() => ({
    corpus: document.getElementById("corpusStatus")?.textContent,
    index: document.getElementById("searchIndexStatus")?.textContent,
    ocr: document.getElementById("ocrStatus")?.textContent,
  }));
  console.log("STATUS", JSON.stringify(st));
  await ctx.close();
})();
