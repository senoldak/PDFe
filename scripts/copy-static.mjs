import { cpSync, mkdirSync, existsSync, renameSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

mkdirSync(dist, { recursive: true });

cpSync(resolve(root, "public/manifest.json"), resolve(dist, "manifest.json"));
cpSync(resolve(root, "public/icons"), resolve(dist, "icons"), { recursive: true });
if (existsSync(resolve(root, "public/models"))) {
  cpSync(resolve(root, "public/models"), resolve(dist, "models"), { recursive: true });
}

const pdfWorker = resolve(root, "node_modules/pdfjs-dist/build/pdf.worker.mjs");
if (existsSync(pdfWorker)) {
  cpSync(pdfWorker, resolve(dist, "pdf.worker.mjs"));
}

const nestedHtml = resolve(dist, "src/viewer/viewer.html");
if (existsSync(nestedHtml)) {
  renameSync(nestedHtml, resolve(dist, "viewer.html"));
  rmSync(resolve(dist, "src"), { recursive: true, force: true });
}

for (const file of ["contentstyle.js", "contentstyle.js.map"]) {
  const path = resolve(dist, file);
  if (existsSync(path)) rmSync(path);
}
cpSync(resolve(root, "src/content/contentstyle.css"), resolve(dist, "contentstyle.css"));

console.log("Static assets copied to dist/");