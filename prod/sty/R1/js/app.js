// STYLE:ON bootstrap — Re:Connect 글래스 내비/역할 스위처/health/프로그레스/라우팅.
import { NAV, ROLES } from "./config.js";
import { h, icon, mount } from "./ui.js";
import { getRole, setRole, onRole, roleMeta } from "./store.js";
import { api, onNetwork } from "./api.js";
import { register, startRouter, activeRoute, go } from "./router.js";
import { toast } from "./overlay.js";

// 기능별 아이콘 (ui.js 의 inline SVG 이름 매핑)
const NAV_ICON = {
  sourcing: "search", sponsor: "sparkles", track: "layers", fit: "wand", ref: "layers",
  lens: "search", trend: "trendUp", pay: "receipt", desk: "calendar", crew: "users",
};
// 모바일 하단 탭에 노출할 핵심 5기능
const QUICK = ["sourcing", "fit", "track", "trend", "crew"];

let mobileOpen = false;

/* ---------- 브랜드 마크 ---------- */
function brandMark() {
  return h("a", { class: "flex items-center gap-2.5 group shrink-0", href: "#/sourcing", "aria-label": "STYLE:ON 홈" },
    h("span", { class: "w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-glow group-hover:scale-105 transition-transform" },
      icon("hanger", { size: 19, stroke: 2 })),
    h("span", { class: "leading-none" },
      h("span", { class: "block text-[19px] font-extrabold tracking-tight text-slate-900" }, "STYLE", h("span", { class: "text-brand-600" }, ":ON")),
      h("span", { class: "block text-[10px] font-semibold text-slate-400 tracking-wide" }, "AI Stylist Work OS")));
}

/* ---------- 데스크톱 메뉴 링크 ---------- */
function navLink(n) {
  return h("a", {
    class: "nav-link inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13.5px] font-medium text-slate-600 hover:text-brand-600 hover:bg-brand-50/60 transition-colors",
    href: n.route, dataset: { nav: n.id },
  },
    icon(NAV_ICON[n.id] || "spark", { size: 15, stroke: 1.9, cls: "opacity-80" }),
    h("span", null, n.label.replace("ON ", "")),
    h("span", { class: "nav-ping" }));
}

/* ---------- 역할 스위처 ---------- */
function roleSwitcher({ stacked = false } = {}) {
  const buttons = ROLES.map(r =>
    h("button", {
      class: "role-btn px-3 py-1.5 rounded-full text-[12.5px] font-semibold text-slate-500 transition-colors",
      dataset: { role: r.id }, title: r.note, type: "button",
      onclick: () => { setRole(r.id); if (mobileOpen) closeMobile(); },
    }, r.short));
  return h("div", {
    class: (stacked ? "flex w-full " : "inline-flex shrink-0 flex-nowrap whitespace-nowrap ") + "items-center gap-1 p-1 rounded-full bg-slate-100/80 border border-slate-200/70",
    role: "group", "aria-label": "역할 전환 (X-Role)",
  }, ...buttons);
}

/* ---------- health 점 ---------- */
function healthDot() {
  return h("div", { class: "health inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100/70 text-[11.5px] font-semibold text-slate-500", id: "health", title: "백엔드 상태" },
    h("span", { class: "dot ping-dot w-2 h-2 rounded-full bg-slate-300 text-slate-300" }),
    h("span", { class: "htxt hidden xl:inline whitespace-nowrap" }, "확인 중"));
}

/* ---------- masthead ---------- */
function buildMasthead() {
  const navLinks = NAV.map(navLink);

  const hamburger = h("button", {
    class: "md:hidden w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center",
    type: "button", "aria-label": "메뉴 열기", onclick: () => toggleMobile(),
  }, icon("menu", { size: 20 }));

  // 데스크톱 글래스 바 (상단)
  const topBar = h("div", { class: "glass-nav" },
    h("div", { class: "max-w-[1240px] mx-auto px-5 h-[68px] flex items-center justify-between gap-4" },
      brandMark(),
      h("nav", { class: "hidden md:flex items-center gap-0.5", "aria-label": "주 메뉴 · 10개 기능" }, ...navLinks),
      h("div", { class: "flex items-center gap-2.5" },
        healthDot(),
        h("div", { class: "hidden md:block" }, roleSwitcher()),
        hamburger)));

  // 데스크톱 보조 내비행 (10기능 가로 스크롤 — 좁아질 때 대비, md 이상 노출)
  const subNav = h("div", { class: "hidden md:block border-b border-slate-100 bg-white/40" },
    h("div", { class: "max-w-[1240px] mx-auto px-5 py-2 overflow-x-auto no-scrollbar" },
      h("nav", { class: "flex items-center gap-1 w-max" },
        ...NAV.map(n => h("a", {
          class: "nav-tag inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors whitespace-nowrap",
          href: n.route, dataset: { navtag: n.id },
        },
          h("span", { class: "mono text-[10px] opacity-70" }, n.tag),
          n.label)))));

  mount(document.getElementById("masthead"), topBar, subNav, mobilePanel());
  buildBottomNav();
  syncRoleButtons();
  syncNav(activeRoute());
}

/* ---------- 모바일 풀스크린 메뉴 패널 ---------- */
function mobilePanel() {
  const links = NAV.map(n =>
    h("a", {
      class: "mob-link flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[15px] font-semibold text-slate-700 hover:bg-brand-50 transition-colors",
      href: n.route, dataset: { mob: n.id }, onclick: () => closeMobile(),
    },
      h("span", { class: "w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center" },
        icon(NAV_ICON[n.id] || "spark", { size: 17, stroke: 1.9 })),
      h("span", { class: "flex-1" }, n.label),
      h("span", { class: "mono text-[11px] text-slate-300" }, n.tag)));

  const panel = h("div", {
    class: "mob-panel fixed inset-0 z-[90] flex flex-col bg-white/95 backdrop-blur-xl translate-x-full transition-transform duration-300 md:hidden",
    id: "mob-panel", "aria-hidden": "true",
  },
    h("div", { class: "h-[68px] px-5 flex items-center justify-between border-b border-slate-100" },
      brandMark(),
      h("button", { class: "w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center",
        type: "button", "aria-label": "메뉴 닫기", onclick: () => closeMobile() }, icon("x", { size: 20 }))),
    h("div", { class: "flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1" }, ...links),
    h("div", { class: "px-4 pt-4 pb-6 border-t border-slate-100 flex flex-col gap-3" },
      h("div", { class: "text-[12px] font-semibold text-slate-400 px-1" }, "역할 전환 (X-Role)"),
      roleSwitcher({ stacked: true }),
      h("a", { class: "btn btn-dark btn-block mt-1", href: "#/fit", onclick: () => closeMobile() },
        icon("wand", { size: 16 }), "ON Fit 트라이온 시작")));
  return panel;
}
function toggleMobile() { mobileOpen ? closeMobile() : openMobile(); }
function openMobile() {
  mobileOpen = true;
  const p = document.getElementById("mob-panel");
  if (p) { p.classList.remove("translate-x-full"); p.setAttribute("aria-hidden", "false"); }
  document.body.style.overflow = "hidden";
}
function closeMobile() {
  mobileOpen = false;
  const p = document.getElementById("mob-panel");
  if (p) { p.classList.add("translate-x-full"); p.setAttribute("aria-hidden", "true"); }
  document.body.style.overflow = "";
}

/* ---------- 모바일 하단 탭바 ---------- */
function buildBottomNav() {
  const bn = document.getElementById("bottom-nav");
  if (!bn) return;
  bn.className = "bottom-nav glass-nav";
  mount(bn, ...QUICK.map(id => {
    const n = NAV.find(x => x.id === id);
    return h("a", { href: n.route, dataset: { bnav: id } },
      icon(NAV_ICON[id] || "spark", { size: 20, stroke: 1.9 }),
      h("span", null, n.label.replace("ON ", "")));
  }));
}

function syncRoleButtons() {
  const role = getRole();
  document.querySelectorAll(".role-btn").forEach(b => {
    const on = b.dataset.role === role;
    b.classList.toggle("bg-white", on);
    b.classList.toggle("text-brand-700", on);
    b.classList.toggle("shadow-sm", on);
    b.classList.toggle("text-slate-500", !on);
  });
}

function syncNav(activeId) {
  let active = null;
  document.querySelectorAll(".nav-link").forEach(a => {
    const isActive = a.dataset.nav === activeId;
    a.classList.toggle("is-active", isActive);
    a.classList.toggle("bg-brand-50/80", isActive);
    if (isActive) active = a;
  });
  document.querySelectorAll(".nav-tag").forEach(a =>
    a.classList.toggle("text-brand-600", a.dataset.navtag === activeId));
  document.querySelectorAll(".nav-tag").forEach(a =>
    a.classList.toggle("bg-brand-50", a.dataset.navtag === activeId));
  document.querySelectorAll("#bottom-nav a").forEach(a =>
    a.classList.toggle("is-active", a.dataset.bnav === activeId));
  document.querySelectorAll(".mob-link").forEach(a =>
    a.classList.toggle("bg-brand-50", a.dataset.mob === activeId));

  const nav = active?.closest("nav");
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
  const dot = el?.querySelector(".dot");
  const foot = document.getElementById("foot-conn");
  const txt = el?.querySelector(".htxt");
  try {
    const data = await api.health();
    if (dot) { dot.classList.remove("bg-slate-300", "text-slate-300", "bg-rose-500", "text-rose-500"); dot.classList.add("bg-emerald-500", "text-emerald-500"); }
    if (txt) txt.textContent = `정상 · 가먼트 ${data.garments}`;
    if (foot) foot.textContent = `● 백엔드 연결됨 · ${data.service} · 가먼트 ${data.garments}`;
  } catch {
    if (dot) { dot.classList.remove("bg-slate-300", "text-slate-300", "bg-emerald-500", "text-emerald-500"); dot.classList.add("bg-rose-500", "text-rose-500"); }
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
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && mobileOpen) closeMobile(); });

  startRouter();
  pollHealth();
  setInterval(pollHealth, 20000);
}

boot();
