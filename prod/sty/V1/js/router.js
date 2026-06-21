// Hash router. Each view module default-exports { render(container, ctx) } and may
// return a cleanup function. ctx carries parsed query params.
import { NAV } from "./config.js";

const routes = new Map();
let current = null;

export function register(id, loader) { routes.set(id, loader); }

function parse() {
  const raw = location.hash.replace(/^#\/?/, "");      // e.g. "sponsor?garment=x"
  const [path, qs] = raw.split("?");
  const id = path || "sourcing";
  const params = Object.fromEntries(new URLSearchParams(qs || ""));
  return { id, params };
}

export function go(route, params) {
  let hash = route.startsWith("#") ? route : `#/${route}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) hash += `?${qs}`;
  }
  if (location.hash === hash) handle();   // force re-render on identical hash
  else location.hash = hash;
}

async function handle() {
  const { id, params } = parse();
  const known = NAV.some(n => n.id === id) ? id : "sourcing";

  if (current?.cleanup) { try { current.cleanup(); } catch { /* ignore */ } }

  const main = document.getElementById("main");
  document.dispatchEvent(new CustomEvent("route:change", { detail: { id: known, params } }));

  const loader = routes.get(known);
  if (!loader) { main.textContent = "Not found"; return; }
  const mod = await loader();
  const view = mod.default || mod;
  current = { id: known };
  main.scrollTop = 0;
  const cleanup = await view.render(main, params);
  current.cleanup = typeof cleanup === "function" ? cleanup : null;
  // move focus to main for a11y, without scrolling
  main.focus?.({ preventScroll: true });
}

export function startRouter() {
  window.addEventListener("hashchange", handle);
  if (!location.hash) location.replace("#/sourcing");
  handle();
}

export function activeRoute() { return parse().id; }
