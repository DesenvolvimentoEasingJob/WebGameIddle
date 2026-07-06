import "./shell.css";
import { mountAnimMapTool } from "./anim-map/mount";
import { mountUiAtlasTool } from "./ui-atlas/mount";

const TOOLS = [
  { id: "ui-atlas", label: "UI Atlas", icon: "🎨", mount: mountUiAtlasTool },
  { id: "anim-map", label: "Animações", icon: "🎬", mount: mountAnimMapTool },
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

const NAV_COLLAPSED_KEY = "dev-tools-nav-collapsed";

let activeUnmount: (() => void) | null = null;
let navCollapsed = localStorage.getItem(NAV_COLLAPSED_KEY) === "1";

function setNavCollapsed(collapsed: boolean): void {
  navCollapsed = collapsed;
  localStorage.setItem(NAV_COLLAPSED_KEY, collapsed ? "1" : "0");
  document.getElementById("app")?.classList.toggle("is-nav-collapsed", collapsed);
  window.dispatchEvent(new Event("resize"));
}

function renderNav(activeId: ToolId): void {
  const nav = document.getElementById("tool-nav");
  if (!nav) return;

  nav.innerHTML = `
    <div class="tool-nav__header">
      <h1 class="tool-nav__brand">
        SkySpire Tools
        <small>Asset editors</small>
      </h1>
      <button type="button" class="tool-nav__collapse" title="Ocultar menu" aria-label="Ocultar menu">‹</button>
    </div>
    ${TOOLS.map(
      (tool) => `
      <button type="button" class="tool-nav__item ${tool.id === activeId ? "is-active" : ""}" data-tool="${tool.id}">
        <span class="tool-nav__icon">${tool.icon}</span>
        <span class="tool-nav__label">${tool.label}</span>
      </button>`,
    ).join("")}
  `;

  nav.querySelector(".tool-nav__collapse")?.addEventListener("click", () => setNavCollapsed(true));

  nav.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.tool as ToolId;
      switchTool(id);
    });
  });
}

function switchTool(id: ToolId): void {
  activeUnmount?.();
  activeUnmount = null;

  const root = document.getElementById("tool-root");
  if (!root) return;

  root.innerHTML = "";
  const tool = TOOLS.find((entry) => entry.id === id);
  if (!tool) return;

  activeUnmount = tool.mount(root);
  renderNav(id);
  history.replaceState(null, "", `#${id}`);
}

document.getElementById("app")?.classList.toggle("is-nav-collapsed", navCollapsed);
document.getElementById("tool-nav-expand")?.addEventListener("click", () => setNavCollapsed(false));

const hash = location.hash.slice(1) as ToolId;
const initial = TOOLS.some((tool) => tool.id === hash) ? hash : "ui-atlas";
switchTool(initial);
