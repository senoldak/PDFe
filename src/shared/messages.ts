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