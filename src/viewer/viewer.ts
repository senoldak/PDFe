import "./viewer.css";
import { loadDocument } from "./pdfLoader";
import { renderPage } from "./pageRenderer";

function getFileParam(): string {
  const url = new URL(location.href);
  const file = url.searchParams.get("file");
  if (file) return decodeURIComponent(file);
  return "";
}

async function init(): Promise<void> {
  const file = getFileParam();
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <div id="toolbar"><span id="title"></span></div>
    <div id="pages"></div>
  `;
  document.getElementById("title")!.textContent = file.split("/").pop() || file;

  const pages = document.getElementById("pages")!;
  const pdf = await loadDocument(file);
  const pageCount = pdf.numPages;

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const container = document.createElement("div");
    container.className = "page-container";
    pages.appendChild(container);
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);
    await renderPage(page, canvas, container, 1.25);
    page.cleanup();
  }
}

void init();
