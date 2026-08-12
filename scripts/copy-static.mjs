import { cpSync, mkdirSync, existsSync, renameSync, rmSync, readdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

mkdirSync(dist, { recursive: true });

cpSync(resolve(root, "public/icons"), resolve(dist, "icons"), { recursive: true });
if (existsSync(resolve(root, "public/models"))) {
  cpSync(resolve(root, "public/models"), resolve(dist, "models"), { recursive: true });
}

const pdfWorker = resolve(root, "node_modules/pdfjs-dist/build/pdf.worker.mjs");
if (existsSync(pdfWorker)) {
  cpSync(pdfWorker, resolve(dist, "pdf.worker.mjs"));
}

const entries = readdirSync(dist, { recursive: true }).map((p) => p.replaceAll("\\", "/"));
const matchBase = (prefix, suffix) =>
  entries.filter((p) => basename(p).startsWith(prefix) && basename(p).endsWith(suffix));

const viewerHtml = entries.filter((p) => basename(p) === "viewer.html");
if (viewerHtml.length === 0) {
  console.error("FATAL: no viewer.html produced under dist/; manifest viewer reference would break");
  process.exit(1);
}
if (viewerHtml.length > 1) {
  console.error(`FATAL: multiple viewer.html files under dist/ (${viewerHtml.join(", ")}); ambiguous`);
  process.exit(1);
}
if (viewerHtml[0] !== "viewer.html") {
  renameSync(resolve(dist, viewerHtml[0]), resolve(dist, "viewer.html"));
  let dir = dirname(resolve(dist, viewerHtml[0]));
  while (dir !== dist) {
    rmSync(dir, { recursive: true, force: true });
    dir = dirname(dir);
  }
}

if (matchBase("viewer", ".js").length === 0) {
  console.error("FATAL: no viewer.js produced under dist/; aborting");
  process.exit(1);
}
if (matchBase("viewer", ".css").length === 0) {
  console.error("FATAL: no viewer css produced under dist/; aborting");
  process.exit(1);
}
if (matchBase("contentstyle", ".css").length === 0) {
  console.error("FATAL: no contentstyle css produced under dist/; aborting");
  process.exit(1);
}
for (const p of [...matchBase("contentstyle", ".js"), ...matchBase("contentstyle", ".js.map")]) {
  rmSync(resolve(dist, p));
}
cpSync(resolve(root, "src/content/contentstyle.css"), resolve(dist, "contentstyle.css"));

for (const p of matchBase("ort-wasm-simd-threaded.jsep", ".wasm")) {
  if (!p.startsWith("models/")) rmSync(resolve(dist, p));
}

const tessDir = resolve(root, "node_modules/tesseract.js/dist");
if (existsSync(tessDir)) cpSync(tessDir, resolve(dist, "tesseract"), { recursive: true });
const coreDir = resolve(root, "node_modules/tesseract.js-core");
if (existsSync(coreDir)) cpSync(coreDir, resolve(dist, "tesseract-core"), { recursive: true });

console.log("Static assets copied to dist/");