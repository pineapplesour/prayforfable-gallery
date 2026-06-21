// STYLE:ON bootstrap: masthead, role switcher, health, network progress, routing.
import { NAV, ROLES } from "./config.js";
import { h, icon, mount, clear } from "./ui.js";
import { getRole, setRole, onRole, roleMeta } from "./store.js";
import { api, onNetwork } from "./api.js";
import { register, startRouter, activeRoute, go } from "./router.js";
import { toast } from "./overlay.js";

/* inline glyphs not in ui.js icon set */
function svgGlyph(d, size = 20) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size); svg.setAttribute("height", size);
  svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = d;
  return svg;
}
const MENU_GLYPH = '<path d="M4 7h16M4 12h16M4 17h16"/>';
// Re:Connect 브랜드 아이콘(초승달+스파클 느낌의 night mark)
const BRAND_GLYPH = '<path d="M20 13.5A8 8 0 1 1 10.5 4a6.2 6.2 0 0 0 9.5 9.5Z"/><path d="M18 4v3M16.5 5.5h3"/>';

/* ---------- masthead ---------- */
function buildMasthead() {
  const navLinks = NAV.map(n =>
    h("a", { class: "nav-link", href: n.route, dataset: { nav: n.id } },
      h("span", { class: "nx" }, n.tag),
      n.label));

  const roleButtons = ROLES.map(r =>
    h("button", { dataset: { role: r.id }, title: r.note, type: "button",
      onclick: () => setRole(r.id) },
      h("span", { class: "role-full" }, r.label)));

  const roles = h("div", { class: "roles", role: "group", "aria-label": "역할 전환 (X-Role)" }, ...roleButtons);

  const health = h("div", { class: "health", id: "health", title: "백엔드 상태" },
    h("span", { class: "dot" }), h("span", { class: "htxt" }, "확인 중"));

  const menuBtn = h("button", { class: "mast-menu-btn", type: "button",
    "aria-label": "메뉴 열기", "aria-expanded": "false", onclick: openMobileMenu },
    svgGlyph(MENU_GLYPH, 20));

  const inner = h("div", { class: "masthead-inner" },
    h("a", { class: "brand", href: "#/sourcing", "aria-label": "STYLE:ON 홈" },
      h("span", { class: "brand-icon", "aria-hidden": "true" }, svgGlyph(BRAND_GLYPH, 19)),
      h("span", { class: "brand-mark" }, "STYLE", h("span", { class: "on" }, ":ON")),
      h("span", { class: "brand-sub" }, "AI Stylist Work OS")),
    h("div", { class: "mast-right" }, health, roles, menuBtn));

  // Dedicated full-width nav row — scales cleanly to all 10 features and
  // scrolls horizontally on narrow viewports (hidden on mobile → hamburger).
  const navRow = h("div", { class: "masthead-navrow" },
    h("nav", { class: "nav", "aria-label": "주 메뉴 · 10개 기능" }, ...navLinks));

  mount(document.getElementById("masthead"), inner, navRow);
  syncRoleButtons();
  syncNav(activeRoute());
}

/* ---------- mobile menu (Re:Connect식 글래스 리스트 패널) ---------- */
function openMobileMenu() {
  const active = activeRoute();
  const role = getRole();

  const navList = h("div", { class: "mm-list" },
    ...NAV.map(n =>
      h("a", { class: "mm-link" + (n.id === active ? " is-active" : ""), href: n.route,
        onclick: () => closeMobileMenu() },
        h("span", { class: "mm-nx" }, n.tag), n.label)));

  const roleList = h("div", { class: "mm-roles" },
    ...ROLES.map(r =>
      h("button", { class: "mm-role" + (r.id === role ? " is-active" : ""), type: "button",
        onclick: () => { setRole(r.id); refreshMobileMenuRoles(); } },
        h("span", null, r.label),
        h("span", { class: "mm-role-note" }, r.note))));

  const panel = h("div", { class: "mm-panel", role: "dialog", "aria-label": "메뉴",
    onclick: (e) => e.stopPropagation() },
    h("div", { class: "mm-head" },
      h("span", { class: "brand-mark" }, "STYLE", h("span", { class: "on" }, ":ON")),
      h("button", { class: "mm-close", "aria-label": "닫기", onclick: closeMobileMenu }, "×")),
    h("div", { class: "mm-section-label" }, "기능 · 10"),
    navList,
    h("div", { class: "mm-section-label" }, "역할 전환 · X-Role"),
    roleList,
    h("div", { class: "mm-foot", id: "mm-foot" }, "연결 확인 중…"));

  const overlay = h("div", { class: "mobile-menu open", id: "mobile-menu",
    onclick: closeMobileMenu },
    h("div", { class: "mm-scrim" }), panel);

  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  document.querySelector(".mast-menu-btn")?.setAttribute("aria-expanded", "true");
  // mirror footer connection status into the panel
  const foot = document.getElementById("foot-conn");
  const mmFoot = document.getElementById("mm-foot");
  if (foot && mmFoot) mmFoot.textContent = foot.textContent;
  document.addEventListener("keydown", onMenuKey);
}

function refreshMobileMenuRoles() {
  const role = getRole();
  document.querySelectorAll(".mm-role").forEach((b, i) =>
    b.classList.toggle("is-active", ROLES[i]?.id === role));
}

function onMenuKey(e) { if (e.key === "Escape") closeMobileMenu(); }

function closeMobileMenu() {
  const overlay = document.getElementById("mobile-menu");
  if (overlay) overlay.remove();
  document.body.style.overflow = "";
  document.querySelector(".mast-menu-btn")?.setAttribute("aria-expanded", "false");
  document.removeEventListener("keydown", onMenuKey);
}

function syncRoleButtons() {
  const role = getRole();
  document.querySelectorAll(".roles button").forEach(b =>
    b.classList.toggle("is-active", b.dataset.role === role));
  refreshMobileMenuRoles();
}

function syncNav(activeId) {
  let active = null;
  document.querySelectorAll(".nav-link").forEach(a => {
    const isActive = a.dataset.nav === activeId;
    a.classList.toggle("is-active", isActive);
    if (isActive) active = a;
  });
  const nav = active?.closest(".nav");
  if (nav && nav.scrollWidth > nav.clientWidth) {
    requestAnimationFrame(() => active.scrollIntoView({ block: "nearest", inline: "center" }));
  }
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
