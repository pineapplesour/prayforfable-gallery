// STYLE:ON bootstrap: left glass sidebar, role switcher, health, network progress, routing.
import { NAV, ROLES } from "./config.js";
import { h, icon, mount } from "./ui.js";
import { getRole, setRole, onRole, roleMeta } from "./store.js";
import { api, onNetwork } from "./api.js";
import { register, startRouter, activeRoute, go } from "./router.js";
import { toast } from "./overlay.js";

// one line-icon per feature (declared in ui.js icon map as `nav_<id>`)
const NAV_ICON = {
  sourcing: "nav_sourcing", sponsor: "nav_sponsor", track: "nav_track",
  fit: "nav_fit", ref: "nav_ref", lens: "nav_lens", trend: "nav_trend",
  pay: "nav_pay", desk: "nav_desk", crew: "nav_crew",
};

/* ---------- left vertical sidebar (V1 structural variation) ---------- */
function brandMark(href = "#/sourcing") {
  return h("a", { class: "brand", href, "aria-label": "STYLE:ON 홈", onclick: closeDrawer },
    h("span", { class: "brand-logo", "aria-hidden": "true" }, "S"),
    h("span", { class: "brand-text" },
      h("span", { class: "brand-mark" }, "STYLE", h("span", { class: "on" }, ":ON")),
      h("span", { class: "brand-sub" }, "AI Stylist Work OS")));
}

function roleSwitcher() {
  const roleButtons = ROLES.map(r =>
    h("button", { dataset: { role: r.id }, title: r.note, type: "button",
      onclick: () => setRole(r.id) },
      h("span", { class: "role-full" }, r.short || r.label)));
  return h("div", { class: "roles", role: "group", "aria-label": "역할 전환 (X-Role)" }, ...roleButtons);
}

function healthChip(id) {
  return h("div", { class: "health", id, title: "백엔드 상태" },
    h("span", { class: "dot" }), h("span", { class: "htxt" }, "확인 중"));
}

function buildSidebar() {
  const navLinks = NAV.map(n =>
    h("a", { class: "nav-link", href: n.route, dataset: { nav: n.id }, onclick: closeDrawer },
      icon(NAV_ICON[n.id] || "spark", { size: 19, cls: "nav-ico" }),
      h("span", { class: "nav-label" }, n.label),
      h("span", { class: "nx" }, n.tag)));

  const sidebar = h("div", { class: "sidebar-inner" },
    h("div", { class: "sidebar-top" }, brandMark()),
    h("nav", { class: "nav", "aria-label": "주 메뉴 · 10개 기능" }, ...navLinks),
    h("div", { class: "sidebar-foot" },
      h("div", { class: "sidebar-foot-label" }, "역할 · X-Role"),
      roleSwitcher(),
      healthChip("health")));

  mount(document.getElementById("sidebar"), sidebar);

  // mobile top glass bar: hamburger + brand + compact role switcher
  const mobilebar = h("div", { class: "mobilebar-inner" },
    h("button", { class: "drawer-btn", type: "button", "aria-label": "메뉴 열기",
      onclick: openDrawer }, icon("menu", { size: 20 })),
    brandMark(),
    h("div", { class: "mobilebar-right" }, roleSwitcher(), healthChip("health-m")));
  mount(document.getElementById("mobilebar"), mobilebar);

  // scrim closes the drawer
  document.getElementById("sidebar-scrim")?.addEventListener("click", closeDrawer);

  syncRoleButtons();
  syncNav(activeRoute());
}

/* ---------- mobile drawer ---------- */
function openDrawer() {
  document.body.classList.add("drawer-open");
}
function closeDrawer() {
  document.body.classList.remove("drawer-open");
}

function syncRoleButtons() {
  const role = getRole();
  document.querySelectorAll(".roles button").forEach(b =>
    b.classList.toggle("is-active", b.dataset.role === role));
}

function syncNav(activeId) {
  document.querySelectorAll(".nav-link").forEach(a =>
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
  const chips = [document.getElementById("health"), document.getElementById("health-m")].filter(Boolean);
  const foot = document.getElementById("foot-conn");
  try {
    const data = await api.health();
    for (const el of chips) {
      el.classList.remove("down"); el.classList.add("ok");
      const txt = el.querySelector(".htxt");
      if (txt) txt.textContent = `정상 · 가먼트 ${data.garments}`;
    }
    if (foot) foot.textContent = `● 백엔드 연결됨 · ${data.service} · 가먼트 ${data.garments}`;
  } catch {
    for (const el of chips) {
      el.classList.remove("ok"); el.classList.add("down");
      const txt = el.querySelector(".htxt");
      if (txt) txt.textContent = "연결 끊김";
    }
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
  buildSidebar();
  wireProgress();

  onRole((role) => {
    syncRoleButtons();
    const m = roleMeta(role);
    toast(`역할이 “${m.label}”(으)로 전환되었습니다 · ${m.note}`, { type: "info", title: "X-Role 변경", timeout: 2600 });
    // re-render current view so role-gated data refreshes
    document.dispatchEvent(new CustomEvent("role:applied"));
  });

  document.addEventListener("route:change", (e) => { syncNav(e.detail.id); closeDrawer(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

  startRouter();
  pollHealth();
  setInterval(pollHealth, 20000);
}

boot();
