export interface ToolbarCallbacks {
  onNavigate: (delta: number) => void;
  onZoom: (factor: number) => void;
  onFind: (query: string) => void;
  onToggleSmartPanel: () => void;
}

export function createToolbar(cb: ToolbarCallbacks): HTMLElement {
  const el = document.createElement("div");
  el.id = "toolbar";
  el.innerHTML = `
    <button data-act="prev" title="Önceki sayfa">‹</button>
    <span id="pageInfo">1 / 1</span>
    <button data-act="next" title="Sonraki sayfa">›</button>
    <button data-act="zoomOut" title="Uzaklaştır">−</button>
    <button data-act="zoomIn" title="Yakınlaştır">+</button>
    <input id="findInput" type="search" placeholder="Ara…" />
    <button data-act="findPrev" title="Önceki sonuç">↑</button>
    <button data-act="findNext" title="Sonraki sonuç">↓</button>
    <button data-act="smart" title="Akıllı Panel">🧠</button>
  `;
  el.querySelector<HTMLButtonElement>("[data-act=prev]")!.onclick = () => cb.onNavigate(-1);
  el.querySelector<HTMLButtonElement>("[data-act=next]")!.onclick = () => cb.onNavigate(1);
  el.querySelector<HTMLButtonElement>("[data-act=zoomOut]")!.onclick = () => cb.onZoom(0.85);
  el.querySelector<HTMLButtonElement>("[data-act=zoomIn]")!.onclick = () => cb.onZoom(1.2);
  el.querySelector<HTMLInputElement>("#findInput")!.addEventListener("input", (e) => cb.onFind((e.target as HTMLInputElement).value));
  el.querySelector<HTMLButtonElement>("[data-act=findPrev]")!.onclick = () => cb.onFind((el.querySelector<HTMLInputElement>("#findInput")!.value));
  el.querySelector<HTMLButtonElement>("[data-act=findNext]")!.onclick = () => cb.onFind((el.querySelector<HTMLInputElement>("#findInput")!.value));
  el.querySelector<HTMLButtonElement>("[data-act=smart]")!.onclick = () => cb.onToggleSmartPanel();
  return el;
}

export function updatePageInfo(el: HTMLElement, current: number, total: number): void {
  el.textContent = `${current} / ${total}`;
}