// ON Crew — stylist crew network wired to the LIVE backend:
//   /api/crew/{agencies,contacts,lookbooks,jobs,knowhow}. Contacts & jobs = PII gated.
//   (Re:Connect 룩)
import { h, icon, mount, chip, skeletonGrid, emptyState, errorState } from "../ui.js";
import { api } from "../api.js";
import { getRole, roleMeta } from "../store.js";
import { API_BASE } from "../config.js";
import { viewHead, redactBanner } from "./sponsor.js";

const TABS = [
  { id: "agencies",  ko: "에이전시", fetch: (o) => api.crewAgencies(o),  paint: agencies,  gated: false },
  { id: "contacts",  ko: "컨택트",   fetch: (o) => api.crewContacts(o),  paint: contacts,  gated: true },
  { id: "lookbooks", ko: "룩북",     fetch: (o) => api.crewLookbooks(o), paint: lookbooks, gated: false },
  { id: "jobs",      ko: "채용",     fetch: (o) => api.crewJobs(o),      paint: jobs,      gated: true },
  { id: "knowhow",   ko: "노하우",   fetch: (o) => api.crewKnowhow(o),   paint: knowhow,   gated: false },
];

let tab = "agencies";
let query = "";
let detach = null;

export default {
  async render(root) {
    mount(root, shell());
    load();
    const handler = () => {
      const note = document.getElementById("crew-rolenote");
      if (note) note.replaceWith(roleNote());
      load();
    };
    document.addEventListener("role:applied", handler);
    detach = () => document.removeEventListener("role:applied", handler);
    return () => { detach?.(); detach = null; };
  },
};

function currentTab() { return TABS.find(t => t.id === tab) || TABS[0]; }

function shell() {
  const searchInput = h("input", { type: "text", id: "crew-q", class: "control !py-2 !text-[13px]",
    style: { width: "auto", minWidth: "200px" }, placeholder: "검색 (브랜드·에이전시·태그…)", value: query });
  searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { query = searchInput.value.trim(); load(); } });

  return h("div", null,
    viewHead("ON CREW · 10", "스타일리스트", "크루 네트워크",
      "에이전시·컨택트·룩북·채용·노하우를 한 곳에서. 컨택트와 채용 담당자 연락처(PII)는 역할(X-Role)에 따라 보호됩니다."),
    h("div", { class: "flex flex-wrap items-center justify-between gap-3 mb-4" },
      h("div", { class: "inline-flex flex-wrap p-1 rounded-2xl bg-slate-100 border border-slate-200/60 gap-0.5" }, ...TABS.map(tabBtn)),
      h("div", { class: "flex items-center gap-2.5" },
        searchInput,
        h("button", { class: "btn btn-ghost btn-sm", onclick: () => { query = searchInput.value.trim(); load(); } }, icon("search", { size: 14 }), "검색"),
        query ? h("button", { class: "btn btn-ghost btn-sm", onclick: () => { query = ""; load(); } }, "초기화") : null)),
    currentTab().gated ? roleNote() : null,
    h("div", { id: "crew-body" }));
}

function tabBtn(t) {
  const on = tab === t.id;
  return h("button", { class: "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[13px] font-semibold transition-colors " +
      (on ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"), role: "tab",
    onclick: () => { if (tab !== t.id) { tab = t.id; mount(document.getElementById("main"), shell()); load(); } } },
    t.ko, t.gated ? icon("lock", { size: 11, cls: "opacity-60" }) : null);
}

function roleNote() {
  const m = roleMeta(getRole());
  const gated = getRole() === "stylist";
  return redactBanner(gated ? "lock" : "info",
    [h("span", null, "현재 역할 ", h("b", null, m.label), " · ", m.note,
      gated ? " — 우측 상단에서 ‘관리자’ 또는 ‘쇼룸 파트너’로 전환하면 연락처가 노출됩니다." : "")], "crew-rolenote");
}

async function load() {
  const body = document.getElementById("crew-body");
  if (!body) return;
  const t = currentTab();
  mount(body, h("div", { class: "mt-2" }, skeletonGrid(4)));
  try {
    const res = await t.fetch({ q: query || undefined, per_page: 50 });
    const rows = res.results || [];
    if (!rows.length) {
      mount(body, emptyState({ title: "결과가 없습니다",
        body: query ? "검색어를 바꾸거나 초기화해 보세요." : "표시할 데이터가 없습니다.", ico: "search" }));
      return;
    }
    const meta = h("div", { class: "text-sm text-slate-500 mb-4" }, t.ko, " ", h("b", { class: "text-slate-800" }, String(res.total ?? rows.length)), "건");
    mount(body, h("div", null, meta, t.paint(rows)));
  } catch (err) { mount(body, errorState(err, load)); }
}

const GRID = "grid sm:grid-cols-2 lg:grid-cols-3 gap-5";
function crewCard(...children) {
  return h("article", { class: "rounded-3xl border border-slate-100 bg-white shadow-card hover:shadow-soft hover:-translate-y-0.5 transition-all p-5 flex flex-col gap-3" }, ...children);
}
function cardHead(title, subNode, badge) {
  return h("div", { class: "flex items-start justify-between gap-3" },
    h("div", { class: "min-w-0" },
      h("h3", { class: "font-extrabold tracking-tight text-slate-800 leading-snug" }, title),
      subNode || null),
    badge || null);
}
function subLine(...children) { return h("div", { class: "flex items-center gap-1.5 text-[12.5px] text-slate-500 mt-0.5" }, ...children); }

/* ---------- tab painters ---------- */
function agencies(rows) {
  return h("div", { class: GRID }, ...rows.map(a =>
    crewCard(
      cardHead(a.name, subLine(icon("pin", { size: 12, cls: "text-brand-400" }), a.location),
        h("span", { class: "pill neutral shrink-0" }, h("span", { class: "pdot" }), a.agency_type)),
      h("p", { class: "text-[13px] text-slate-600 leading-relaxed" }, a.summary),
      tagRow(a.tags))));
}

function contacts(rows) {
  return h("div", { class: GRID }, ...rows.map(c => {
    const cm = c.contact_manager || {};
    return crewCard(
      cardHead(c.brand_name, c.agency_name ? subLine(icon("building", { size: 12, cls: "text-brand-400" }), c.agency_name) : null,
        (c.categories || []).length ? h("span", { class: "pill neutral shrink-0" }, h("span", { class: "pdot" }), c.categories[0]) : null),
      contactBlock(cm),
      c.notes ? h("p", { class: "text-[12.5px] text-slate-400 leading-relaxed" }, c.notes) : null,
      tagRow(c.tags));
  }));
}

function lookbooks(rows) {
  return h("div", { class: GRID }, ...rows.map(l =>
    crewCard(
      cardHead(l.title, subLine(l.brand_name, l.agency_name ? ` · ${l.agency_name}` : ""),
        h("span", { class: "pill info shrink-0" }, h("span", { class: "pdot" }), l.season)),
      l.summary ? h("p", { class: "text-[13px] text-slate-600 leading-relaxed" }, l.summary) : null,
      tagRow(l.tags),
      l.url ? h("a", { class: "btn btn-ghost btn-sm self-start", href: API_BASE + l.url, target: "_blank", rel: "noopener" },
        icon("layers", { size: 14 }), "룩북 열기") : null)));
}

function jobs(rows) {
  return h("div", { class: GRID }, ...rows.map(j => {
    const cm = j.contact_manager || {};
    return crewCard(
      cardHead(j.title, subLine(j.company, " · ", icon("pin", { size: 12, cls: "text-brand-400" }), j.location),
        h("span", { class: "pill neutral shrink-0" }, h("span", { class: "pdot" }), j.job_type)),
      j.pay_note ? h("div", { class: "flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 bg-brand-50 rounded-xl px-3 py-2 self-start" }, icon("info", { size: 13 }), j.pay_note) : null,
      contactBlock(cm),
      tagRow(j.tags));
  }));
}

function knowhow(rows) {
  return h("div", { class: GRID }, ...rows.map(k =>
    crewCard(
      cardHead(k.title, null, h("span", { class: "pill neutral shrink-0" }, h("span", { class: "pdot" }), k.topic)),
      h("p", { class: "text-[13px] text-slate-600 leading-relaxed" }, k.body),
      tagRow(k.tags))));
}

/* ---------- shared bits ---------- */
function contactBlock(cm) {
  const head = h("div", { class: "flex items-baseline gap-2" },
    h("span", { class: "font-bold text-slate-800 text-[14px]" }, cm.name || "—"),
    cm.role ? h("span", { class: "text-[12px] text-slate-400" }, cm.role) : null);
  if (cm.redacted) {
    return h("div", null, head, redactBanner("lock",
      [h("span", null, h("b", null, "연락처 비공개"), " · 현재 역할(", roleMeta(getRole()).label, ")에서는 보호됩니다.")]));
  }
  return h("div", null, head,
    h("div", { class: "flex flex-col gap-1.5 mt-2" },
      cm.phone ? cRow("전화", "phone", h("a", { class: "text-brand-700 font-medium", href: `tel:${cm.phone}` }, cm.phone)) : null,
      cm.email ? cRow("이메일", "mail", h("a", { class: "text-brand-700 font-medium", href: `mailto:${cm.email}` }, cm.email)) : null));
}
function cRow(label, ico, value) {
  return h("div", { class: "flex items-center gap-2 text-[13px]" },
    h("span", { class: "w-10 text-slate-400 shrink-0" }, label), icon(ico, { size: 14, cls: "text-brand-400" }), value);
}
function tagRow(tags) {
  const list = tags || [];
  if (!list.length) return null;
  return h("div", { class: "flex flex-wrap gap-1.5 mt-auto pt-1" }, ...list.slice(0, 6).map(t => chip(t, { tag: true })));
}
