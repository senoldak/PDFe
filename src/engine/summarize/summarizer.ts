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