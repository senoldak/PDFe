import { describe, expect, it, vi } from "vitest";
import { pipeline } from "@huggingface/transformers";
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
  it("chunks long text and joins summaries in order", async () => {
    const pipe = (await (pipeline as any)()) as ReturnType<typeof vi.fn>;
    pipe.mockClear();
    pipe.mockImplementation(async (text: string) => [{ summary_text: `özet:${text.split(" ")[0]}` }]);
    const s = new Summarizer();
    await s.init();
    const text = Array.from({ length: 450 }, (_, i) => `w${i}`).join(" ");
    const result = await s.summarize(text);
    expect(pipe).toHaveBeenCalledTimes(2);
    expect(result).toBe("özet:w0 özet:w400");
  });
});