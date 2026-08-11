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