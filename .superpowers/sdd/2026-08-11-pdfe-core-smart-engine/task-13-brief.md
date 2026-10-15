### Task 13: Akıllı Panel — özetleme

**Files:**
- Create: `src/engine/summarize/summarizer.ts`
- Modify: `src/viewer/smartPanel.ts`
- Test: `tests/unit/summarizer.test.ts`

**Interfaces:**
- Consumes: transformers.js `pipeline("summarization", ...)`
- Produces: `class Summarizer { init(): Promise<void>; summarize(text: string, maxLength?: number): Promise<string> }` — uzun metni map-reduce ile parçalar.

- [ ] **Step 1: src/engine/summarize/summarizer.ts yaz**

```ts
import { pipeline } from "@huggingface/transformers";

const MODEL = "Xenova/distilbart-cnn-6-6";
type SummarizationPipeline = (text: string, opts: { max_length: number; min_length: number }) => Promise<{ summary_text: string }[]>;

const CHUNK_WORDS = 800;

function chunkText(text: string, maxWords: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
  }
  return chunks;
}

export class Summarizer {
  private pipe: SummarizationPipeline | null = null;

  async init(): Promise<void> {
    this.pipe = (await pipeline("summarization", MODEL)) as unknown as SummarizationPipeline;
  }

  async summarize(text: string, maxLength = 120): Promise<string> {
    if (!this.pipe) throw new Error("Summarizer not initialized");
    const chunks = chunkText(text, CHUNK_WORDS);
    if (chunks.length === 0) return "";
    const parts: string[] = [];
    for (const c of chunks) {
      const [out] = await this.pipe(c, { max_length: Math.min(maxLength, 200), min_length: 20 });
      parts.push(out.summary_text);
    }
    return parts.length === 1 ? parts[0] : parts.join(" ");
  }
}
```

- [ ] **Step 2: summarizer.test.ts yaz** (mock)

```ts
import { describe, expect, it, vi } from "vitest";
import { Summarizer } from "../../src/engine/summarize/summarizer";

vi.mock("@huggingface/transformers", () => {
  const pipe = vi.fn(async (_t: string) => [{ summary_text: "özet çıktısı" }]);
  return { pipeline: vi.fn().mockResolvedValue(pipe) };
});

describe("Summarizer", () => {
  it("returns summary for short text", async () => {
    const s = new Summarizer();
    await s.init();
    expect(await s.summarize("bu bir faturanın uzun metnidir")).toBe("özet çıktısı");
  });
  it("returns empty for empty text", async () => {
    const s = new Summarizer();
    await s.init();
    expect(await s.summarize("   ")).toBe("");
  });
});
```

- [ ] **Step 3: smartPanel.ts'ye özet butonu bağla**

Modify `src/viewer/smartPanel.ts`: `SmartPanelCallbacks`'a `summarizer: Summarizer` ekle; `bindSmartPanel` içinde `#summarizeBtn` tıklanınca `summarizer.summarize(corpus.fullText)` çağırıp `#summaryOutput`'a yaz (corpus `pipeline` üzerinden erişilir — `SmartPanelCallbacks`'a `getCorpus: () => DocumentCorpus | null` ekle).

- [ ] **Step 4: test + typecheck + build**

Run: `npm run test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/summarize src/viewer/smartPanel.ts tests/unit/summarizer.test.ts
git commit -m "feat: add local summarization with map-reduce chunking"
```

---