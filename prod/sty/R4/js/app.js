// STYLE:ON bootstrap — Re:Connect 디자인 언어 셸:
// 글래스 마스트헤드 + 보라 그라데이션 브랜드 + 역할 스위처 + health 점 +
// 모바일 햄버거 메뉴 + 하단 탭바 + 전역 네트워크 프로그레스바 + 라우팅.
import { NAV, ROLES } from "./config.js";
import { h, icon, mount } from "./ui.js";
import { getRole, setRole, onRole, roleMeta } from "./store.js";
import { api, onNetwork } from "./api.js";
import { register, startRouter, activeRoute, go } from "./router.js";
import { toast } from "./overlay.js";

// 모바일 하단 탭에 노출할 5개 (나머지는 햄버거 메뉴)
const BOTTOM = ["sourcing", "fit", "track", "crew", "__more"];
const BOTTOM_ICON = { sourcing: "search", fit: "wand", track: "layers", crew: "building", __more: "menu" };

/* ---------- masthead (glass nav) ---------- */
function buildMasthead() {
  const navLinks = NAV.map(n =>
    h("a", { class: "nav-link", href: n.route, dataset: { nav: n.id } },
      h("span", { class: "nx" }, n.tag),
      n.label));

  const roleButtons = ROLES.map(r =>
    h("button", { dataset: { role: r.id }, title: r.note, type: "button",
      onclick: () => setRole(r.id) },
      h("span", { class: "role-full" }, r.short)));

  const roles = h("div", { class: "roles", role: "group", "aria-label": "역할 전환 (X-Role)" }, ...roleButtons);

  const health = h("div", { class: "health", id: "health", title: "백엔드 상태" },
    h("span", { class: "dot" }), h("span", { class: "htxt" }, "확인 중"));

  const burger = h("button", { class: "mobile-menu-btn", type: "button",
    "aria-label": "메뉴 열기", onclick: openMobileMenu }, icon("menu", { size: 22 }));

  const inner = h("div", { class: "masthead-inner" },
    h("a", { class: "brand", href: "#/sourcing", "aria-label": "STYLE:ON 홈" },
      h("span", { class: "brand-icon" }, icon("moon", { size: 21 })),
      h("span", { class: "brand-wordmark" },
        h("span", { class: "brand-mark" }, "STYLE", h("span", { class: "on" }, ":ON")),
        h("span", { class: "brand-sub" }, "AI Stylist Work OS"))),
    h("div", { class: "mast-right" }, health, roles, burger));

  // 전폭 nav 행 — 10개 기능, 좁은 화면에선 숨고 햄버거로 대체
  const navRow = h("div", { class: "masthead-navrow" },
    h("nav", { class: "nav", "aria-label": "주 메뉴 · 10개 기능" }, ...navLinks));

  mount(document.getElementById("masthead"), inner, navRow);
  buildBottomNav();
  syncRoleButtons();
  syncNav(activeRoute());
}

/* ---------- mobile bottom nav ---------- */
function buildBottomNav() {
  const el = document.getElementById("bottom-nav");
  if (!el) return;
  const items = BOTTOM.map(id => {
    if (id === "__more") {
      return h("button", { class: "bn-link", type: "button", dataset: { bn: "__more" },
        onclick: openMobileMenu },
        icon("menu", { size: 21 }), h("span", null, "전체"));
    }
    const n = NAV.find(x => x.id === id);
    return h("a", { class: "bn-link", href: n.route, dataset: { bn: id } },
      icon(BOTTOM_ICON[id], { size: 21 }), h("span", null, n.label.replace("ON ", "")));
  });
  mount(el, ...items);
}

/* ---------- mobile slide-down menu ---------- */
function openMobileMenu() {
  const role = getRole();
  const overlay = h("div", { class: "mobile-menu-overlay", onclick: (e) => { if (e.target === overlay) close(); } });
  const close = () => { overlay.remove(); panel.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };

  const links = NAV.map(n =>
    h("a", { class: "mm-link" + (n.id === activeRoute() ? " is-active" : ""), href: n.route,
      onclick: () => setTimeout(close, 10) },
      h("span", { class: "nx" }, n.tag), n.label));

  const roleBtns = ROLES.map(r =>
    h("button", { type: "button", class: r.id === role ? "is-active" : "",
      onclick: () => { setRole(r.id); close(); } }, r.short));

  const panel = h("div", { class: "mobile-menu", role: "dialog", "aria-label": "메뉴" },
    h("div", { class: "mm-head" },
      h("span", { class: "brand" },
        h("span", { class: "brand-icon" }, icon("moon", { size: 19 })),
        h("span", { class: "brand-mark" }, "STYLE", h("span", { class: "on" }, ":ON"))),
      h("button", { class: "modal-close", "aria-label": "닫기", onclick: close }, "×")),
    h("div", { class: "redact", style: { marginBottom: "10px" } },
      icon("info", { size: 15 }),
      h("span", null, "역할(X-Role) · ", h("b", null, roleMeta(role).label))),
    h("div", { class: "mm-roles" }, ...roleBtns),
    h("div", { class: "mm-list" }, ...links),
    h("button", { class: "mm-cta", type: "button", onclick: () => { go("fit"); close(); } },
      icon("wand", { size: 18 }), "ON Fit 트라이온 시작"));

  document.body.append(overlay, panel);
  document.addEventListener("keydown", onKey);
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
  // bottom-nav active state
  document.querySelectorAll(".bn-link").forEach(a =>
    a.classList.toggle("is-active", a.dataset.bn === activeId));
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
    document.dispatchEvent(new CustomEvent("role:applied"));
  });

  document.addEventListener("route:change", (e) => syncNav(e.detail.id));

  startRouter();
  pollHealth();
  setInterval(pollHealth, 20000);
}

boot();
