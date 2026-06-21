// STYLE:ON bootstrap — Re:Connect family look, "mobile app shell" variation (V2).
// A slim glass top app-bar + a fixed bottom tab bar (5 primary tabs); the rest of
// the 10 features live in a "더보기" sheet, with the role switcher.
import { NAV, ROLES } from "./config.js";
import { h, icon, mount, clear } from "./ui.js";
import { getRole, setRole, onRole, roleMeta } from "./store.js";
import { api, onNetwork } from "./api.js";
import { register, startRouter, activeRoute, go } from "./router.js";
import { toast } from "./overlay.js";

// Tiny inline glyphs for the bottom tab bar (Lucide-ish, stroke).
const TAB_ICONS = {
  sourcing: '<path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35"/>',
  fit:      '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  track:    '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
  crew:     '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  more:     '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
};
// The 5 primary tabs surfaced in the bottom bar (matches the Re:Connect bottom-nav idea).
const PRIMARY = ["sourcing", "fit", "track", "crew"];

function glyph(name, { size = 22 } = {}) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size); svg.setAttribute("height", size);
  svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = TAB_ICONS[name] || TAB_ICONS.more;
  return svg;
}

/* ---------- top app-bar (slim, glass) ---------- */
function buildMasthead() {
  const health = h("div", { class: "health", id: "health", title: "백엔드 상태" },
    h("span", { class: "dot" }), h("span", { class: "htxt" }, "확인 중"));

  const roleBtn = h("button", { class: "role-trigger", type: "button",
    "aria-label": "역할 전환", title: "역할 전환 (X-Role)", onclick: openSheet },
    h("span", { class: "role-avatar", id: "role-avatar" }, "ST"),
    h("span", { class: "role-cur", id: "role-cur" }, "스타일리스트"),
    icon("arrowRight", { size: 13, cls: "role-caret" }));

  const inner = h("div", { class: "appbar-inner" },
    h("a", { class: "brand", href: "#/sourcing", "aria-label": "STYLE:ON 홈" },
      h("span", { class: "brand-logo", "aria-hidden": "true" }, glyph("fit", { size: 18 })),
      h("span", { class: "brand-mark" }, "STYLE", h("span", { class: "on" }, ":ON"))),
    h("div", { class: "mast-right" }, health, roleBtn));

  mount(document.getElementById("masthead"), inner);
  buildTabbar();
  syncRoleButtons();
  syncNav(activeRoute());
}

/* ---------- bottom tab bar (the V2 "mobile app shell" signature) ---------- */
function buildTabbar() {
  const tabs = PRIMARY.map(id => {
    const n = NAV.find(x => x.id === id);
    return h("a", { class: "tab", href: n.route, dataset: { nav: id } },
      h("span", { class: "tab-ico" }, glyph(id)),
      h("span", { class: "tab-lbl" }, n.label.replace(/^ON\s*/, "")));
  });
  const moreTab = h("button", { class: "tab tab-more", type: "button", dataset: { nav: "more" },
    "aria-label": "더보기 메뉴", onclick: openSheet },
    h("span", { class: "tab-ico" }, glyph("more")),
    h("span", { class: "tab-lbl" }, "더보기"));

  const bar = document.getElementById("tabbar");
  mount(bar, h("nav", { class: "tabbar-inner", "aria-label": "주 메뉴 · 하단 탭" }, ...tabs, moreTab));
}

/* ---------- "더보기" sheet: remaining 6 features + role switcher ---------- */
let sheetOpen = false;
function openSheet() {
  if (sheetOpen) return;
  sheetOpen = true;
  const active = activeRoute();

  const featLinks = NAV.map(n =>
    h("a", { class: "sheet-link" + (n.id === active ? " is-active" : ""),
      href: n.route, dataset: { nav: n.id },
      onclick: () => closeSheet() },
      h("span", { class: "sheet-tag" }, n.tag),
      h("span", { class: "sheet-name" }, n.label),
      icon("arrowRight", { size: 15, cls: "sheet-go" })));

  const roleButtons = ROLES.map(r =>
    h("button", { class: "role-opt", dataset: { role: r.id }, type: "button",
      onclick: () => { setRole(r.id); } },
      h("span", { class: "ro-label" }, r.label),
      h("span", { class: "ro-note" }, r.note),
      icon("check", { size: 16, cls: "ro-check" })));

  const sheet = h("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": "메뉴" },
    h("div", { class: "sheet-grab", "aria-hidden": "true" }),
    h("div", { class: "sheet-sec" },
      h("div", { class: "sheet-h" }, "역할 · X-Role"),
      h("div", { class: "role-opts", id: "role-opts" }, ...roleButtons)),
    h("div", { class: "sheet-sec" },
      h("div", { class: "sheet-h" }, "모든 기능 · 10"),
      h("div", { class: "sheet-links" }, ...featLinks)));

  const overlay = h("div", { class: "sheet-overlay", id: "sheet-overlay",
    onclick: (e) => { if (e.target === overlay) closeSheet(); } }, sheet);

  const onKey = (e) => { if (e.key === "Escape") closeSheet(); };
  overlay._onKey = onKey;
  document.addEventListener("keydown", onKey);
  document.body.style.overflow = "hidden";
  mount(document.getElementById("sheet-root"), overlay);
  requestAnimationFrame(() => overlay.classList.add("is-open"));
  syncRoleButtons();
}
function closeSheet() {
  const root = document.getElementById("sheet-root");
  const overlay = document.getElementById("sheet-overlay");
  if (overlay) {
    document.removeEventListener("keydown", overlay._onKey);
    overlay.classList.remove("is-open");
    setTimeout(() => clear(root), 240);
  }
  document.body.style.overflow = "";
  sheetOpen = false;
}

function syncRoleButtons() {
  const role = getRole();
  const m = roleMeta(role);
  const cur = document.getElementById("role-cur");
  const av = document.getElementById("role-avatar");
  if (cur) cur.textContent = m.short;
  if (av) av.textContent = role === "admin" ? "AD" : role === "showroom-partner" ? "SR" : "ST";
  document.querySelectorAll(".role-opt").forEach(b =>
    b.classList.toggle("is-active", b.dataset.role === role));
}

function syncNav(activeId) {
  // bottom tabs: light up the primary tab; if active route is a secondary
  // feature, light up "더보기" instead.
  const isPrimary = PRIMARY.includes(activeId);
  document.querySelectorAll(".tab").forEach(a => {
    const id = a.dataset.nav;
    const on = id === "more" ? !isPrimary : id === activeId;
    a.classList.toggle("is-active", on);
  });
  // sheet links (if open)
  document.querySelectorAll(".sheet-link").forEach(a =>
    a.classList.toggle("is-active", a.dataset.nav === activeId));
}

/* ---------- network progress bar ---------- */
function wireProgress() {
  const bar = document.getElementById("topbar-progress");
  let width = 0, raf = null;
  onNetwork((count) => {
    if (count > 0) {
      bar.classList.add("is-active");
      cancelAnimationFrame(raf);
      const tick = () => { width = Math.min(90, width + (90 - width) * 0.08 + 0.6); bar.style.width = width + "%"; if (count > 0) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf);
      bar.style.width = "100%";
      setTimeout(() => { bar.classList.remove("is-active"); bar.style.width = "0"; width = 0; }, 280);
    }
  });
}

/* ---------- health polling ---------- */
async function pollHealth() {
  const el = document.getElementById("health");
  const foot = document.getElementById("foot-conn");
  const txt = el?.querySelector(".htxt");
  try {
    const data = await api.health();
    el?.classList.remove("down"); el?.classList.add("ok");
    if (txt) txt.textContent = `정상 · 가먼트 ${data.garments}`;
    if (foot) foot.textContent = `● 백엔드 연결됨 · ${data.service} · 가먼트 ${data.garments}`;
  } catch {
    el?.classList.remove("ok"); el?.classList.add("down");
    if (txt) txt.textContent = "연결 끊김";
    if (foot) foot.textContent = "○ 백엔드 연결 끊김 — uvicorn :8770 실행 확인";
  }
}

/* ---------- register views (lazy) ---------- */
register("sourcing", () => import("./views/sourcing.js"));
register("sponsor",  () => import("./views/sponsor.js"));
register("track",    () => import("./views/track.js"));
register("fit",      () => import("./views/fit.js"));
register("ref",      () => import("./views/ref.js"));
register("lens",     () => import("./views/lens.js"));
register("trend",    () => import("./views/trend.js"));
register("pay",      () => import("./views/pay.js"));
register("desk",     () => import("./views/desk.js"));
register("crew",     () => import("./views/crew.js"));

/* ---------- boot ---------- */
function boot() {
  buildMasthead();
  wireProgress();

  onRole((role) => {
    syncRoleButtons();
    closeSheet();
    const m = roleMeta(role);
    toast(`역할이 “${m.label}”(으)로 전환되었습니다 · ${m.note}`, { type: "info", title: "X-Role 변경", timeout: 2600 });
    // re-render current view so role-gated data refreshes
    document.dispatchEvent(new CustomEvent("role:applied"));
  });

  document.addEventListener("route:change", (e) => syncNav(e.detail.id));

  startRouter();
  pollHealth();
  setInterval(pollHealth, 20000);
}

boot();
