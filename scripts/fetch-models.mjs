import { mkdirSync, existsSync, copyFileSync, createWriteStream, createReadStream, renameSync, rmSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
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

const SHAS = {
  "onnx/Xenova/all-MiniLM-L6-v2/config.json": "7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7",
  "onnx/Xenova/all-MiniLM-L6-v2/tokenizer.json": "da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0",
  "onnx/Xenova/all-MiniLM-L6-v2/tokenizer_config.json": "9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3",
  "onnx/Xenova/all-MiniLM-L6-v2/special_tokens_map.json": "b6d346be366a7d1d48332dbc9fdf3bf8960b5d879522b7799ddba59e76237ee3",
  "onnx/Xenova/all-MiniLM-L6-v2/vocab.txt": "07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3",
  "onnx/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx": "afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1",
  "onnx/Xenova/distilbart-cnn-6-6/config.json": "2e16f80f1dbbda53094b15f45d6e2953ced17bff4c6f9dc3f8e24ebbe701e09d",
  "onnx/Xenova/distilbart-cnn-6-6/generation_config.json": "85c3e01442b11210b4a8f07fccadb863288720812e4b073f67ede39fae1feeba",
  "onnx/Xenova/distilbart-cnn-6-6/tokenizer.json": "2f1a555a1ee93656b4e6f67aa75d492a843c225e5ef754bae24c36bd85851cd7",
  "onnx/Xenova/distilbart-cnn-6-6/tokenizer_config.json": "c56f73109691e1540cff519360cd1472045cd3d9d42f687d4478fe87f5f10c06",
  "onnx/Xenova/distilbart-cnn-6-6/special_tokens_map.json": "8293ae960b0a0852d4d3813118030a1149a3ed9fe37bc2e1e7b3c2e62eb2d4b7",
  "onnx/Xenova/distilbart-cnn-6-6/vocab.json": "ed19656ea1707df69134c4af35c8ceda2cc9860bf2c3495026153a133670ab5e",
  "onnx/Xenova/distilbart-cnn-6-6/merges.txt": "1ce1664773c50f3e0cc8842619a93edc4624525b728b188a9e0be33b7726adc5",
  "onnx/Xenova/distilbart-cnn-6-6/onnx/encoder_model_quantized.onnx": "14d9b2d8fb1b6ebf7133046eaba3ea0dc0539be0523caa14c3e9b22131518a02",
  "onnx/Xenova/distilbart-cnn-6-6/onnx/decoder_model_merged_quantized.onnx": "7a584dce621f77e39008055b6ef4ae9d3698241758e568edf3e5b0ad5fd6ccb2",
  "tessdata/tur.traineddata": "489b9504e80d7184ed1ac9a1976647884ee71149da231ff3c2c1dc15370f2f3d",
  "tessdata/eng.traineddata": "daa0c97d651c19fba3b25e81317cd697e9908c8208090c94c3905381c23fc047",
};

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
      const hash = createHash("sha256");
      await streamPipeline(createReadStream(tmp), hash);
      const actual = hash.digest("hex");
      if (SHAS[label] && actual !== SHAS[label]) {
        throw new Error(`checksum mismatch: expected ${SHAS[label]}, got ${actual}`);
      }
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