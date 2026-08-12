import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("dist/pdf.worker.mjs");

export async function loadDocument(url: string): Promise<PDFDocumentProxy> {
  const task = getDocument({ url });
  return task.promise;
}
