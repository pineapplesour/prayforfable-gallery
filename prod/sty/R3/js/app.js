// STYLE:ON bootstrap — Re:Connect skin shell: glass nav, gradient wordmark,
// hamburger mobile menu panel, role switcher, health dot, network progress, routing.
import { NAV, ROLES } from "./config.js";
import { h, icon, mount } from "./ui.js";
import { getRole, setRole, onRole, roleMeta } from "./store.js";
import { api, onNetwork } from "./api.js";
import { register, startRouter, activeRoute, go } from "./router.js";
import { toast } from "./overlay.js";

/* ---------- masthead (glass nav) ---------- */
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
    icon("menu", { size: 22 }));

  const inner = h("div", { class: "masthead-inner" },
    h("a", { class: "brand", href: "#/sourcing", "aria-label": "STYLE:ON 홈" },
      h("span", { class: "brand-mark" }, "STYLE", h("span", { class: "on" }, ":ON")),
      h("span", { class: "brand-sub" }, "AI Stylist Work OS")),
    h("div", { class: "mast-right" }, health, roles, menuBtn));

  const navRow = h("div", { class: "masthead-navrow" },
    h("nav", { class: "nav", "aria-label": "주 메뉴 · 10개 기능" }, ...navLinks));

  mount(document.getElementById("masthead"), inner, navRow);
  syncRoleButtons();
  syncNav(activeRoute());
}

function syncRoleButtons() {
  const role = getRole();
  document.querySelectorAll(".roles button").forEach(b =>
    b.classList.toggle("is-active", b.dataset.role === role));
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

/* ---------- mobile menu panel (Re:Connect style) ---------- */
function openMobileMenu() {
  const root = document.getElementById("mobile-menu");
  const activeId = activeRoute();

  const links = NAV.map(n =>
    h("a", { class: "mm-link" + (n.id === activeId ? " is-active" : ""), href: n.route,
      onclick: () => closeMobileMenu() },
      n.label, h("span", { class: "mm-nx" }, n.tag)));

  const roleRow = h("div", { class: "mm-role-row" },
    ...ROLES.map(r => h("button", {
      class: "mm-role" + (r.id === getRole() ? " is-active" : ""), type: "button",
      title: r.note,
      onclick: () => { setRole(r.id); refreshMobileRoles(); } }, r.label)));

  const panel = h("div", { class: "mm-panel", role: "dialog", "aria-modal": "true", "aria-label": "메뉴" },
    h("div", { class: "mm-head" },
      h("span", { class: "brand-mark", style: { fontSize: "19px" } }, "STYLE", h("span", { class: "on" }, ":ON")),
      h("button", { class: "mm-close", type: "button", "aria-label": "메뉴 닫기", onclick: closeMobileMenu },
        icon("x", { size: 20 }))),
    h("nav", { class: "mm-list", "aria-label": "10개 기능" }, ...links),
    h("div", { class: "mm-roles", id: "mm-roles" },
      h("div", { class: "mm-roles-lbl" }, "역할 전환 · X-Role"),
      roleRow),
    h("a", { class: "mm-cta", href: "#/fit", onclick: closeMobileMenu },
      icon("wand", { size: 18 }), "ON Fit 트라이온 열기"));

  const overlay = h("div", { class: "mm-overlay", onclick: closeMobileMenu });

  mount(root, overlay, panel);
  root.classList.add("open");
  root.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  document.querySelector(".mast-menu-btn")?.setAttribute("aria-expanded", "true");
  document.addEventListener("keydown", onMenuKey);
}

function refreshMobileRoles() {
  syncRoleButtons();
  document.querySelectorAll("#mm-roles .mm-role").forEach(b =>
    b.classList.toggle("is-active", b.textContent === roleMeta(getRole()).label));
}

function onMenuKey(e) { if (e.key === "Escape") closeMobileMenu(); }

function closeMobileMenu() {
  const root = document.getElementById("mobile-menu");
  root.classList.remove("open");
  root.setAttribute("aria-hidden", "true");
  mount(root);
  document.body.style.overflow = "";
  document.querySelector(".mast-menu-btn")?.setAttribute("aria-expanded", "false");
  document.removeEventListener("keydown", onMenuKey);
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
    document.dispatchEvent(new CustomEvent("role:applied"));
  });

  document.addEventListener("route:change", (e) => syncNav(e.detail.id));

  startRouter();
  pollHealth();
  setInterval(pollHealth, 20000);
}

boot();
