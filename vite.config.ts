import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        viewer: resolve(__dirname, "src/viewer/viewer.html"),
        background: resolve(__dirname, "src/background/background.ts"),
        contentscript: resolve(__dirname, "src/content/contentscript.ts"),
        contentstyle: resolve(__dirname, "src/content/contentstyle.css"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  worker: {
    format: "es",
  },
  plugins: [
    {
      name: "pdfe-copy-static",
      closeBundle() {
        try {
          execFileSync(process.execPath, [resolve(__dirname, "scripts/copy-static.mjs")], {
            stdio: "inherit",
          });
        } catch (e) {
          if (this.meta.watchMode) {
            console.error("copy-static failed (watch continues):", e instanceof Error ? e.message : String(e));
          } else {
            throw e;
          }
        }
      },
    },
  ],
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/unit/setup.ts"],
  },
});