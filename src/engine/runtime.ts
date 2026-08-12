import { env } from "@huggingface/transformers";

export function configureRuntime(): void {
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.localModelPath = chrome.runtime.getURL("dist/models/onnx/");
  const onnx = env.backends.onnx as { wasm?: { wasmPaths?: string } };
  onnx.wasm = onnx.wasm ?? {};
  onnx.wasm.wasmPaths = chrome.runtime.getURL("dist/models/ort/");
}