// STYLE:ON bootstrap: masthead, role switcher, health, network progress, routing.
import { NAV, ROLES } from "./config.js";
import { h, icon, mount } from "./ui.js";
import { getRole, setRole, onRole, roleMeta } from "./store.js";
import { api, onNetwork } from "./api.js";
import { register, startRouter, activeRoute, go } from "./router.js";
import { toast } from "./overlay.js";

/* ---------- brand mark (Re:Connect-style violet glyph) ---------- */
function brandLogo() {
  const el = h("span", { class: "brand-logo", "aria-hidden": "true" });
  // sparkle/wand glyph — premium AI stylist mark
  el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M4.9 6.3l2.1 2.1M17 15.6l2.1 2.1M3 12h3M18 12h3M4.9 17.7 7 15.6M17 8.4l2.1-2.1"/><circle cx="12" cy="12" r="3.4"/></svg>';
  return el;
}

/* ---------- masthead ---------- */
function buildMasthead() {
  const navLinks = NAV.map(n =>
    h("a", { class: "nav-link", href: n.route, dataset: { nav: n.id } },
      h("span", { class: "nx" }, n.tag),
      n.label));

  const roleButtons = ROLES.map(r =>
    h("button", { dataset: { role: r.id }, title: r.note, type: "button",
      onclick: () => setRole(r.id) },
      h("span", { class: "role-full" }, r.short || r.label)));

  const roles = h("div", { class: "roles", role: "group", "aria-label": "역할 전환 (X-Role)" }, ...roleButtons);

  const health = h("div", { class: "health", id: "health", title: "백엔드 상태" },
    h("span", { class: "dot" }), h("span", { class: "htxt" }, "확인 중"));

  const menuBtn = h("button", { class: "mast-menu-btn", type: "button",
    "aria-label": "메뉴 열기", "aria-expanded": "false",
    onclick: openMobileMenu });
  menuBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

  const inner = h("div", { class: "masthead-inner" },
    h("a", { class: "brand", href: "#/sourcing", "aria-label": "STYLE:ON 홈" },
      brandLogo(),
      h("span", { class: "brand-mark" }, "STYLE", h("span", { class: "on" }, ":ON")),
      h("span", { class: "brand-sub" }, "AI Stylist Work OS")),
    h("div", { class: "mast-right" }, health, roles, menuBtn));

  // Dedicated full-width nav row — scales cleanly to all 10 features and
  // scrolls horizontally on narrow viewports.
  const navRow = h("div", { class: "masthead-navrow" },
    h("nav", { class: "nav", "aria-label": "주 메뉴 · 10개 기능" }, ...navLinks));

  mount(document.getElementById("masthead"), inner, navRow);
  syncRoleButtons();
  syncNav(activeRoute());
}

/* ---------- mobile menu (Re:Connect slide-in panel) ---------- */
let mobileMenuEl = null;
function openMobileMenu() {
  closeMobileMenu();
  const active = activeRoute();
  const role = getRole();

  const links = NAV.map(n =>
    h("a", { class: "mm-link" + (n.id === active ? " is-active" : ""), href: n.route,
      onclick: () => closeMobileMenu() },
      n.label, h("span", { class: "nx" }, n.tag)));

  const roleBtns = ROLES.map(r =>
    h("button", { class: "mm-role" + (r.id === role ? " is-active" : ""), type: "button",
      onclick: () => { setRole(r.id); closeMobileMenu(); } },
      h("span", null, r.label), h("small", null, r.note)));

  const closeBtn = h("button", { class: "mm-close", type: "button", "aria-label": "닫기",
    onclick: closeMobileMenu }, "×");

  const panel = h("div", { class: "mobile-menu-panel", role: "dialog", "aria-modal": "true", "aria-label": "메뉴" },
    h("div", { class: "mm-head" },
      h("span", { class: "brand" }, brandLogo(),
        h("span", { class: "brand-mark" }, "STYLE", h("span", { class: "on" }, ":ON"))),
      closeBtn),
    h("div", { class: "mm-section-label" }, "10개 기능"),
    h("div", { class: "mm-links" }, ...links),
    h("div", { class: "mm-divider" }),
    h("div", { class: "mm-roles-label" }, "역할 전환 · X-Role"),
    h("div", { class: "mm-roles" }, ...roleBtns));

  const backdrop = h("div", { class: "mobile-menu-backdrop", onclick: closeMobileMenu });
  mobileMenuEl = h("div", { class: "mobile-menu open" }, backdrop, panel);
  document.body.append(mobileMenuEl);
  document.body.style.overflow = "hidden";
  document.querySelector(".mast-menu-btn")?.setAttribute("aria-expanded", "true");
  document.addEventListener("keydown", onMenuKey);
}
function closeMobileMenu() {
  if (mobileMenuEl) { mobileMenuEl.remove(); mobileMenuEl = null; }
  document.body.style.overflow = "";
  document.querySelector(".mast-menu-btn")?.setAttribute("aria-expanded", "false");
  document.removeEventListener("keydown", onMenuKey);
}
function onMenuKey(e) { if (e.key === "Escape") closeMobileMenu(); }

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

  document.addEventListener("route:change", (e) => { syncNav(e.detail.id); closeMobileMenu(); });

  startRouter();
  pollHealth();
  setInterval(pollHealth, 20000);
}

boot();
