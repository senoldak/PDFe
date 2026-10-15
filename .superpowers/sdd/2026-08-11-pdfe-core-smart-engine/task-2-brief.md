### Task 2: Shared tipler + mesaj protokolü

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/messages.ts`
- Test: `tests/unit/types.test.ts`

**Interfaces:**
- Consumes: —
- Produces: Aşağıdaki tip/mesaj tanımları sonraki tüm görevlerin sözleşmesi.

- [ ] **Step 1: src/shared/types.ts yaz**

```ts
export interface Bbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TextSpan {
  text: string;
  bbox?: Bbox;
  confidence?: number;
}

export interface PageText {
  pageNumber: number;
  text: string;
  spans: TextSpan[];
  source: "textlayer" | "ocr";
}

export interface DocumentCorpus {
  pages: PageText[];
  fullText: string;
}

export interface SearchResult {
  pageNumber: number;
  spanIndex: number;
  span: TextSpan;
  score: number;
  kind: "semantic" | "literal" | "regex";
}

export interface ExtractionResult {
  [field: string]: string | number | null;
}

export type OcrStatus = "idle" | "loading" | "running" | "done" | "failed";
export type EngineState = {
  ocr: OcrStatus;
  ocrProgress: number; // 0..1
  corpusReady: boolean;
  searchReady: boolean;
};

export interface ExtractionSchema {
  fields: Record<string, { label: string; pattern: string }>;
}
```

- [ ] **Step 2: src/shared/messages.ts yaz**

```ts
import type { DocumentCorpus, SearchResult, ExtractionResult, EngineState } from "./types";

export type Message =
  | { type: "engine:ocr-progress"; progress: number }
  | { type: "engine:corpus-ready"; corpus: DocumentCorpus }
  | { type: "engine:state"; state: EngineState }
  | { type: "engine:search"; query: string }
  | { type: "engine:search-results"; results: SearchResult[] }
  | { type: "engine:summarize"; text: string }
  | { type: "engine:summary"; summary: string }
  | { type: "engine:extract"; schemaId: string }
  | { type: "engine:extracted"; result: ExtractionResult }
  | { type: "viewer:navigate"; page: number }
  | { type: "viewer:get-url" }
  | { type: "viewer:url"; url: string };

export type MessageHandler = (msg: Message) => void;
```

- [ ] **Step 3: tests/unit/types.test.ts yaz**

```ts
import { describe, expect, it } from "vitest";
import type { DocumentCorpus, PageText } from "../../src/shared/types";

describe("shared types", () => {
  it("DocumentCorpus is built from PageText items", () => {
    const page: PageText = {
      pageNumber: 1,
      text: "hello",
      spans: [{ text: "hello", bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } }],
      source: "textlayer",
    };
    const corpus: DocumentCorpus = { pages: [page], fullText: "hello" };
    expect(corpus.pages[0].text).toBe("hello");
    expect(corpus.fullText).toContain("hello");
  });
});
```

- [ ] **Step 4: testi çalıştır, başarısız olmalı (derleme yoksa)**

Run: `npm run test`
Expected: dosya yoksa "No test files found" değilse import hatası. Test dosyası yazıldıktan sonra `npx vitest run tests/unit/types.test.ts` PASS olur (saf tip testi — implementasyon içermediğinden ilk koşuda geçer; bu görevde amaç sözleşmeyi sabitlemek).

- [ ] **Step 5: Commit**

```bash
git add src/shared tests/unit/types.test.ts
git commit -m "feat: define shared types and message protocol"
```

---