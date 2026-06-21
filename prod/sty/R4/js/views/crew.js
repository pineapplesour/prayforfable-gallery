// ON Crew — stylist crew network wired to the LIVE backend:
//   /api/crew/agencies · /api/crew/contacts · /api/crew/lookbooks ·
//   /api/crew/jobs · /api/crew/knowhow
// Contacts & jobs expose manager PII gated by X-Role; switching the role
// switcher (top bar) re-runs the active tab so redaction updates live.
import { h, icon, mount, chip, skeletonGrid, emptyState, errorState } from "../ui.js";
import { api } from "../api.js";
import { getRole, roleMeta } from "../store.js";
import { API_BASE } from "../config.js";

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
    // re-run on role change → PII updates; also refresh the gated role banner
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
  const searchInput = h("input", { type: "text", id: "crew-q", class: "control",
    style: { width: "auto", minWidth: "200px" }, placeholder: "검색 (브랜드·에이전시·태그…)", value: query });
  searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { query = searchInput.value.trim(); load(); } });

  return h("section", { class: "view" },
    h("header", { class: "view-head" },
      h("div", { class: "eyebrow" }, "ON CREW · 10"),
      h("h1", { class: "view-title" }, "스타일리스트 ", h("em", null, "크루 네트워크")),
      h("p", { class: "view-lede" }, "에이전시·컨택트·룩북·채용·노하우를 한 곳에서. 컨택트와 채용 담당자 연락처(PII)는 역할(X-Role)에 따라 보호됩니다.")),
    h("div", { class: "track-toolbar" },
      h("div", { class: "track-tabs", role: "tablist" }, ...TABS.map(t => tabBtn(t))),
      h("div", { class: "row", style: { gap: "10px" } },
        searchInput,
        h("button", { class: "btn btn-ghost btn-sm", onclick: () => { query = searchInput.value.trim(); load(); } }, icon("search", { size: 14 }), "검색"),
        query ? h("button", { class: "btn btn-ghost btn-sm", onclick: () => { query = ""; load(); } }, "초기화") : null)),
    currentTab().gated ? roleNote() : null,
    h("div", { id: "crew-body" }));
}

function tabBtn(t) {
  return h("button", { class: tab === t.id ? "is-active" : "", role: "tab",
    onclick: () => { if (tab !== t.id) { tab = t.id; mount(document.getElementById("main"), shell()); load(); } } },
    t.ko, t.gated ? h("span", { class: "tab-lock" }, icon("lock", { size: 11 })) : null);
}

function roleNote() {
  const m = roleMeta(getRole());
  const gated = getRole() === "stylist";
  return h("div", { class: "redact", id: "crew-rolenote", style: { marginBottom: "18px" } },
    icon(gated ? "lock" : "info", { size: 15 }),
    h("span", null, "현재 역할 ", h("b", null, m.label), " · ", m.note,
      gated ? " — 우측 상단에서 ‘관리자’ 또는 ‘쇼룸 파트너’로 전환하면 연락처가 노출됩니다." : ""));
}

async function load() {
  const body = document.getElementById("crew-body");
  if (!body) return;
  const t = currentTab();
  mount(body, h("div", { style: { marginTop: "6px" } }, skeletonGrid(4)));
  try {
    const res = await t.fetch({ q: query || undefined, per_page: 50 });
    const rows = res.results || [];
    if (!rows.length) {
      mount(body, emptyState({ title: "결과가 없습니다",
        body: query ? "검색어를 바꾸거나 초기화해 보세요." : "표시할 데이터가 없습니다.", ico: "search" }));
      return;
    }
    const meta = h("div", { class: "results-meta" },
      h("div", { class: "count" }, t.ko, " ", h("b", null, String(res.total ?? rows.length)), "건"));
    mount(body, h("div", null, meta, t.paint(rows)));
  } catch (err) {
    mount(body, errorState(err, load));
  }
}

/* ---------- tab painters ---------- */
function agencies(rows) {
  return h("div", { class: "crew-grid" }, ...rows.map(a =>
    h("article", { class: "crew-card" },
      h("div", { class: "crew-card-head" },
        h("div", null,
          h("h3", { class: "crew-name" }, a.name),
          h("div", { class: "crew-sub muted" }, icon("pin", { size: 12 }), " ", a.location)),
        h("span", { class: "pill neutral" }, h("span", { class: "pdot" }), a.agency_type)),
      h("p", { class: "crew-summary" }, a.summary),
      tagRow(a.tags))));
}

function contacts(rows) {
  return h("div", { class: "crew-grid" }, ...rows.map(c => {
    const cm = c.contact_manager || {};
    return h("article", { class: "crew-card" },
      h("div", { class: "crew-card-head" },
        h("div", null,
          h("h3", { class: "crew-name" }, c.brand_name),
          c.agency_name ? h("div", { class: "crew-sub muted" }, icon("building", { size: 12 }), " ", c.agency_name) : null),
        (c.categories || []).length ? h("span", { class: "pill neutral" }, h("span", { class: "pdot" }), c.categories[0]) : null),
      contactBlock(cm),
      c.notes ? h("p", { class: "crew-summary muted" }, c.notes) : null,
      tagRow(c.tags));
  }));
}

function lookbooks(rows) {
  return h("div", { class: "crew-grid" }, ...rows.map(l =>
    h("article", { class: "crew-card" },
      h("div", { class: "crew-card-head" },
        h("div", null,
          h("h3", { class: "crew-name" }, l.title),
          h("div", { class: "crew-sub muted" }, l.brand_name, l.agency_name ? ` · ${l.agency_name}` : "")),
        h("span", { class: "pill info" }, h("span", { class: "pdot" }), l.season)),
      l.summary ? h("p", { class: "crew-summary" }, l.summary) : null,
      tagRow(l.tags),
      l.url ? h("a", { class: "btn btn-ghost btn-sm", href: API_BASE + l.url, target: "_blank", rel: "noopener", style: { marginTop: "4px" } },
        icon("layers", { size: 14 }), "룩북 열기") : null)));
}

function jobs(rows) {
  return h("div", { class: "crew-grid" }, ...rows.map(j => {
    const cm = j.contact_manager || {};
    return h("article", { class: "crew-card" },
      h("div", { class: "crew-card-head" },
        h("div", null,
          h("h3", { class: "crew-name" }, j.title),
          h("div", { class: "crew-sub muted" }, j.company, " · ", icon("pin", { size: 12 }), " ", j.location)),
        h("span", { class: "pill neutral" }, h("span", { class: "pdot" }), j.job_type)),
      j.pay_note ? h("div", { class: "crew-pay" }, icon("info", { size: 13 }), " ", j.pay_note) : null,
      contactBlock(cm),
      tagRow(j.tags));
  }));
}

function knowhow(rows) {
  return h("div", { class: "crew-grid" }, ...rows.map(k =>
    h("article", { class: "crew-card" },
      h("div", { class: "crew-card-head" },
        h("h3", { class: "crew-name" }, k.title),
        h("span", { class: "pill neutral" }, h("span", { class: "pdot" }), k.topic)),
      h("p", { class: "crew-summary" }, k.body),
      tagRow(k.tags))));
}

/* ---------- shared bits ---------- */
function contactBlock(cm) {
  const head = h("div", { class: "crew-contact-head" },
    h("span", { class: "crew-contact-name" }, cm.name || "—"),
    cm.role ? h("span", { class: "crew-contact-role muted" }, cm.role) : null);
  if (cm.redacted) {
    return h("div", { class: "crew-contact" }, head,
      h("div", { class: "redact", style: { marginTop: "8px" } },
        icon("lock", { size: 14 }),
        h("span", null, h("b", null, "연락처 비공개"), " · 현재 역할(", roleMeta(getRole()).label, ")에서는 보호됩니다.")));
  }
  return h("div", { class: "crew-contact" }, head,
    h("div", { class: "contact-rows", style: { marginTop: "8px" } },
      cm.phone ? h("div", { class: "cr" }, h("span", { class: "k" }, "전화"), icon("phone", { size: 14 }), h("a", { href: `tel:${cm.phone}` }, cm.phone)) : null,
      cm.email ? h("div", { class: "cr" }, h("span", { class: "k" }, "이메일"), icon("mail", { size: 14 }), h("a", { href: `mailto:${cm.email}` }, cm.email)) : null));
}

function tagRow(tags) {
  const list = tags || [];
  if (!list.length) return null;
  return h("div", { class: "gcard-tags", style: { marginTop: "auto" } }, ...list.slice(0, 6).map(t => chip(t, { tag: true })));
}
