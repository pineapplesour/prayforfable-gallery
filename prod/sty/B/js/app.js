// STYLE:ON · Work Console — bootstrap.
// Variant B art direction: a minimal pro-SaaS console (Linear / Notion / Vercel /
// Raycast). Left rail with the 10 features, a slim command bar, ⌘K command
// palette, role switcher, health dot, and a global network progress bar.
//
// Data/routing layer (api.js / config.js / store.js / router.js) is UNCHANGED —
// this file only owns the shell chrome and wires the lazy view registry.
import { NAV, ROLES } from "./config.js";
import { h, icon, mount } from "./ui.js";
import { getRole, setRole, onRole, roleMeta } from "./store.js";
import { api, onNetwork } from "./api.js";
import { register, startRouter, activeRoute, go } from "./router.js";
import { toast } from "./overlay.js";

/* per-feature one-line subtitle shown in the command bar */
const NAV_DESC = {
  sourcing: "무드·컨셉을 협찬 가능한 실제 재고로 랭킹",
  sponsor:  "셀럽·브랜드 협찬 가용성 + 매니저 채널",
  track:    "협찬 진행 보드 · 상태 머신 · 충돌 감지",
  fit:      "가상 트라이온 · 비동기 렌더 파이프라인",
  ref:      "레퍼런스 무드를 실제 카탈로그로 매칭",
  lens:     "이미지로 아이템 식별 + 유사 후보",
  trend:    "현재 랭킹 + 4주 시계열 예측",
  pay:      "영수증 파싱 → 정산 데이터 + CSV",
  desk:     "촬영 스케줄 · 반납 D-day 데스크",
  crew:     "에이전시·컨택트·룩북·채용·노하우",
};

/* ============================================================
   Sidebar (left rail)
   ============================================================ */
function buildSidebar() {
  const brand = h("a", { class: "side-brand", href: "#/sourcing", "aria-label": "STYLE:ON 홈" },
    h("span", { class: "side-brand-mark" }, "S"),
    h("span", { class: "side-brand-text" },
      h("span", { class: "sbt-name" }, "STYLE", h("span", { class: "on" }, ":ON")),
      h("span", { class: "sbt-sub" }, "WORK CONSOLE")));

  const cmdBtn = h("button", { class: "side-cmd", type: "button", onclick: openPalette, "aria-label": "커맨드 팔레트 열기" },
    icon("search", { size: 15 }),
    h("span", { class: "side-cmd-txt" }, "빠른 이동…"),
    h("kbd", { class: "kbd" }, "⌘K"));

  const navItems = NAV.map(n =>
    h("a", { class: "side-link", href: n.route, dataset: { nav: n.id }, title: NAV_DESC[n.id] || n.label },
      h("span", { class: "side-num mono" }, n.tag),
      h("span", { class: "side-label" }, n.label),
      h("span", { class: "side-go", "aria-hidden": "true" }, icon("arrowRight", { size: 13 }))));

  const nav = h("nav", { class: "side-nav", "aria-label": "기능 메뉴 · 10개" },
    h("div", { class: "side-nav-head" }, "FEATURES"),
    ...navItems);

  const roleButtons = ROLES.map(r =>
    h("button", { class: "role-pick", dataset: { role: r.id }, title: r.note, type: "button",
      onclick: () => setRole(r.id) },
      h("span", { class: "role-pick-name" }, r.label),
      h("span", { class: "role-pick-note" }, r.note)));

  const roleBlock = h("div", { class: "side-roles" },
    h("div", { class: "side-nav-head" }, "ROLE · X-Role"),
    h("div", { class: "role-list" }, ...roleButtons));

  const health = h("div", { class: "side-health", id: "health", title: "백엔드 상태" },
    h("span", { class: "dot" }),
    h("span", { class: "htxt mono" }, "확인 중"));

  const inner = h("div", { class: "side-inner" },
    h("div", { class: "side-top" }, brand, cmdBtn, nav),
    h("div", { class: "side-bottom" }, roleBlock, health));

  mount(document.getElementById("sidebar"), inner);
  syncRoleButtons();
  syncNav(activeRoute());
}

/* ============================================================
   Topbar (slim command bar)
   ============================================================ */
function buildTopbar() {
  const menuBtn = h("button", { class: "top-menu", type: "button", "aria-label": "메뉴 열기",
    onclick: () => toggleDrawer(true) }, hamburger());

  const crumb = h("div", { class: "top-crumb" },
    h("span", { class: "top-tag mono", id: "top-tag" }, "01"),
    h("div", { class: "top-titles" },
      h("h1", { class: "top-title", id: "top-title" }, "ON Sourcing"),
      h("span", { class: "top-desc", id: "top-desc" }, NAV_DESC.sourcing)));

  const cmdBtn = h("button", { class: "top-cmd", type: "button", onclick: openPalette, "aria-label": "커맨드 팔레트" },
    icon("search", { size: 14 }),
    h("span", { class: "top-cmd-txt" }, "이동"),
    h("kbd", { class: "kbd" }, "⌘K"));

  const roleTag = h("button", { class: "top-role", type: "button", id: "top-role",
    title: "역할 전환 (X-Role)", onclick: cycleRole });

  const inner = h("div", { class: "top-inner" },
    h("div", { class: "top-left" }, menuBtn, crumb),
    h("div", { class: "top-right" }, cmdBtn, roleTag));

  mount(document.getElementById("topbar"), inner);
  syncTopbar(activeRoute());
  syncRoleTag();
}

function hamburger() {
  const s = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(s, "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("width", "18"); svg.setAttribute("height", "18");
  svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8"); svg.setAttribute("stroke-linecap", "round");
  svg.innerHTML = '<path d="M4 7h16M4 12h16M4 17h16"/>';
  return svg;
}

function cycleRole() {
  const order = ROLES.map(r => r.id);
  const idx = order.indexOf(getRole());
  setRole(order[(idx + 1) % order.length]);
}

function syncTopbar(activeId) {
  const n = NAV.find(x => x.id === activeId) || NAV[0];
  const tag = document.getElementById("top-tag");
  const title = document.getElementById("top-title");
  const desc = document.getElementById("top-desc");
  if (tag) tag.textContent = n.tag;
  if (title) title.textContent = n.label;
  if (desc) desc.textContent = NAV_DESC[n.id] || "";
}

function syncRoleTag() {
  const el = document.getElementById("top-role");
  if (!el) return;
  const m = roleMeta(getRole());
  el.dataset.role = getRole();
  el.replaceChildren(
    h("span", { class: "trole-dot" }),
    h("span", { class: "trole-name" }, m.label),
    icon("refresh", { size: 12, cls: "trole-cyc" }));
}

/* ============================================================
   Sync helpers
   ============================================================ */
function syncRoleButtons() {
  const role = getRole();
  document.querySelectorAll(".role-pick").forEach(b =>
    b.classList.toggle("is-active", b.dataset.role === role));
}

function syncNav(activeId) {
  document.querySelectorAll(".side-link").forEach(a =>
    a.classList.toggle("is-active", a.dataset.nav === activeId));
}

/* ============================================================
   Command palette (⌘K)  — Raycast/Linear-style quick jump
   ============================================================ */
let paletteOpen = false;
function openPalette() {
  if (paletteOpen) return;
  paletteOpen = true;
  const root = document.getElementById("palette-root");
  const prevFocus = document.activeElement;

  let filtered = NAV.slice();
  let cursor = 0;

  const input = h("input", { class: "pal-input", type: "text", placeholder: "기능 검색 — 예: 트랙, fit, 정산…",
    "aria-label": "기능 검색", autocomplete: "off", spellcheck: "false" });
  const list = h("div", { class: "pal-list", role: "listbox" });

  function rowFor(n, i) {
    return h("button", { class: "pal-row" + (i === cursor ? " is-cur" : ""), type: "button",
      role: "option", "aria-selected": String(i === cursor),
      onmousemove: () => { if (cursor !== i) { cursor = i; paint(); } },
      onclick: () => choose(n) },
      h("span", { class: "pal-num mono" }, n.tag),
      h("span", { class: "pal-label" }, n.label),
      h("span", { class: "pal-desc" }, NAV_DESC[n.id] || ""),
      h("span", { class: "pal-enter mono" }, i === cursor ? "↵" : ""));
  }

  function paint() {
    mount(list, ...filtered.map((n, i) => rowFor(n, i)));
    if (!filtered.length) mount(list, h("div", { class: "pal-empty" }, "일치하는 기능이 없습니다"));
    const cur = list.querySelector(".pal-row.is-cur");
    cur?.scrollIntoView({ block: "nearest" });
  }

  function refilter() {
    const q = input.value.trim().toLowerCase();
    filtered = !q ? NAV.slice() : NAV.filter(n =>
      n.label.toLowerCase().includes(q) || n.id.includes(q) ||
      (NAV_DESC[n.id] || "").toLowerCase().includes(q) || n.tag.includes(q));
    cursor = 0; paint();
  }

  function choose(n) { close(); go(n.id); }

  function close() {
    paletteOpen = false;
    overlay.remove();
    document.removeEventListener("keydown", onKey, true);
    prevFocus?.focus?.();
  }

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); cursor = Math.min(filtered.length - 1, cursor + 1); paint(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); cursor = Math.max(0, cursor - 1); paint(); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[cursor]) choose(filtered[cursor]); }
  }

  input.addEventListener("input", refilter);

  const panel = h("div", { class: "pal-panel", role: "dialog", "aria-modal": "true", "aria-label": "커맨드 팔레트" },
    h("div", { class: "pal-head" }, icon("search", { size: 16, cls: "pal-head-ico" }), input,
      h("kbd", { class: "kbd" }, "ESC")),
    list,
    h("div", { class: "pal-foot" },
      h("span", null, h("kbd", { class: "kbd" }, "↑"), h("kbd", { class: "kbd" }, "↓"), " 이동"),
      h("span", null, h("kbd", { class: "kbd" }, "↵"), " 선택"),
      h("span", { class: "pal-foot-brand mono" }, "STYLE:ON")));

  const overlay = h("div", { class: "pal-overlay", onclick: (e) => { if (e.target === overlay) close(); } }, panel);
  mount(root, overlay);
  document.addEventListener("keydown", onKey, true);
  paint();
  input.focus();
}

/* ============================================================
   Mobile drawer
   ============================================================ */
function toggleDrawer(open) {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  if (!sidebar || !backdrop) return;
  if (open) {
    sidebar.classList.add("is-open");
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add("is-on"));
  } else {
    sidebar.classList.remove("is-open");
    backdrop.classList.remove("is-on");
    setTimeout(() => { backdrop.hidden = true; }, 240);
  }
}

/* ============================================================
   Network progress bar
   ============================================================ */
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

/* ============================================================
   Health polling
   ============================================================ */
async function pollHealth() {
  const el = document.getElementById("health");
  const foot = document.getElementById("foot-conn");
  const txt = el?.querySelector(".htxt");
  try {
    const data = await api.health();
    el?.classList.remove("down"); el?.classList.add("ok");
    if (txt) txt.textContent = `연결됨 · ${data.garments}`;
    if (foot) foot.textContent = `● 백엔드 연결됨 · ${data.service} · 가먼트 ${data.garments}`;
  } catch {
    el?.classList.remove("ok"); el?.classList.add("down");
    if (txt) txt.textContent = "연결 끊김";
    if (foot) foot.textContent = "○ 백엔드 연결 끊김 — uvicorn :8770 실행 확인";
  }
}

/* ============================================================
   View registry (lazy)
   ============================================================ */
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

/* ============================================================
   Boot
   ============================================================ */
function boot() {
  buildSidebar();
  buildTopbar();
  wireProgress();

  // backdrop closes the drawer
  document.getElementById("sidebar-backdrop")?.addEventListener("click", () => toggleDrawer(false));

  // global ⌘K / Ctrl+K
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault(); if (!paletteOpen) openPalette();
    }
  });

  onRole((role) => {
    syncRoleButtons();
    syncRoleTag();
    const m = roleMeta(role);
    toast(`역할이 “${m.label}”(으)로 전환되었습니다 · ${m.note}`, { type: "info", title: "X-Role 변경", timeout: 2600 });
    document.dispatchEvent(new CustomEvent("role:applied"));
  });

  document.addEventListener("route:change", (e) => {
    syncNav(e.detail.id);
    syncTopbar(e.detail.id);
    toggleDrawer(false);   // close drawer on navigation
  });

  startRouter();
  pollHealth();
  setInterval(pollHealth, 20000);
}

boot();
