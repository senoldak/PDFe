import { mkdirSync, existsSync, copyFileSync, createWriteStream, renameSync, rmSync, statSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline as streamPipeline } from "node:stream/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dest = resolve(root, "public/models");
mkdirSync(dest, { recursive: true });

const HF = "https://huggingface.co";

const REPOS = {
  "Xenova/all-MiniLM-L6-v2": [
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "vocab.txt",
    "onnx/model_quantized.onnx",
  ],
  "Xenova/distilbart-cnn-6-6": [
    "config.json",
    "generation_config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "vocab.json",
    "merges.txt",
    "onnx/encoder_model_quantized.onnx",
    "onnx/decoder_model_merged_quantized.onnx",
  ],
};

const jobs = [];
for (const [repo, files] of Object.entries(REPOS)) {
  for (const file of files) {
    jobs.push({
      url: `${HF}/${repo}/resolve/main/${file}`,
      out: resolve(dest, "onnx", repo, file),
    });
  }
}
for (const lang of ["tur", "eng"]) {
  jobs.push({
    url: `https://raw.githubusercontent.com/tesseract-ocr/tessdata/main/${lang}.traineddata`,
    out: resolve(dest, "tessdata", `${lang}.traineddata`),
  });
}

const RETRIES = 4;
const CONCURRENCY = 3;

async function download(job, label) {
  if (existsSync(job.out)) {
    console.log("skip", label);
    return;
  }
  mkdirSync(dirname(job.out), { recursive: true });
  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const tmp = job.out + ".part";
    try {
      const res = await fetch(job.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error("no response body");
      await streamPipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
      const len = statSync(tmp).size;
      if (len === 0) throw new Error("empty response");
      renameSync(tmp, job.out);
      console.log("saved", label, `(${len} bytes)`);
      return;
    } catch (e) {
      lastErr = e;
      console.log(`retry ${attempt}/${RETRIES} ${label}: ${e.message}`);
      try { rmSync(tmp, { force: true }); } catch {}
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

async function runPool(items, worker, limit) {
  const results = [];
  let i = 0;
  const runner = async () => {
    while (i < items.length) {
      const idx = i++;
      results.push(await worker(items[idx]));
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  return results;
}

const failures = [];
await runPool(
  jobs,
  async (job) => {
    const label = relative(dest, job.out);
    try {
      await download(job, label);
    } catch (e) {
      failures.push({ label, error: e.message });
      console.log("FAILED", label, e.message);
    }
  },
  CONCURRENCY
);

const ortDir = resolve(dest, "ort");
mkdirSync(ortDir, { recursive: true });
const tDist = resolve(root, "node_modules/@huggingface/transformers/dist");
for (const f of ["ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm"]) {
  const src = resolve(tDist, f);
  if (existsSync(src)) {
    copyFileSync(src, resolve(ortDir, f));
    console.log("copied", f, "from node_modules");
  } else {
    console.log("WARN missing in node_modules:", f);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} download(s) failed:`);
  for (const f of failures) console.error(`  - ${f.label}: ${f.error}`);
  process.exit(1);
}