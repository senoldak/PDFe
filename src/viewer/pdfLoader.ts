import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.mjs");

export async function loadDocument(url: string): Promise<PDFDocumentProxy> {
  const task = getDocument({ url });
  return task.promise;
}
