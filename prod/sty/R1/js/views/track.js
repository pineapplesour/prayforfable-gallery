// ON Track — sponsorship board grouped by status with D-day, state-machine
// transitions, and a conflicts view. (Re:Connect 룩)
import { h, icon, mount, swatch, statusMeta, statusPill, ddayBadge, errorState, emptyState, skeletonGrid } from "../ui.js";
import { api, ApiError } from "../api.js";
import { celebName, brandName } from "../catalog.js";
import { modal, toast } from "../overlay.js";
import { viewHead, sectionLabel } from "./sponsor.js";

const COLUMNS = ["candidate", "requested", "reserved", "picked_up", "returned", "rejected"];
const NEXT = {
  candidate: ["requested", "rejected"], requested: ["reserved", "rejected"],
  reserved: ["picked_up", "rejected"], picked_up: ["returned"], returned: [], rejected: [],
};
const TARGET = {
  requested: { ko: "요청으로", cls: "btn-soft" }, reserved: { ko: "예약 확정", cls: "btn-soft" },
  picked_up: { ko: "픽업 처리", cls: "btn-soft" }, returned: { ko: "반납 처리", cls: "btn-primary" },
  rejected: { ko: "거절", cls: "btn-ghost" },
};

let tab = "board";
let statusFilter = "";

export default {
  async render(root) { mount(root, shell()); load(); return () => {}; },
};

function shell() {
  return h("div", null,
    viewHead("ON TRACK · 03", "협찬", "진행을 한 화면에서",
      "후보부터 반납까지 상태별 보드로 추적하고, 상태 전이는 검증된 상태 머신을 따릅니다. 동일 재고의 일정 충돌도 자동 감지합니다."),
    toolbar(),
    h("div", { id: "track-body" }));
}

function toolbar() {
  return h("div", { class: "flex flex-wrap items-center justify-between gap-3 mb-5" },
    h("div", { class: "inline-flex p-1 rounded-full bg-slate-100 border border-slate-200/60" },
      tabBtn("board", "보드"), tabBtn("conflicts", "충돌 감지")),
    h("div", { class: "flex items-center gap-2.5" },
      tab === "board" ? statusFilterSel() : null,
      h("button", { class: "btn btn-ghost btn-sm", onclick: load }, icon("refresh", { size: 14 }), "새로고침")));
}
function tabBtn(id, label) {
  const on = tab === id;
  return h("button", { class: "px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors " +
      (on ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"), role: "tab",
    onclick: () => { if (tab !== id) { tab = id; mount(document.getElementById("main"), shell()); load(); } } }, label);
}
function statusFilterSel() {
  const sel = h("select", { class: "control !py-2 !text-[13px] w-auto", style: { minWidth: "130px" },
    onchange: () => { statusFilter = sel.value; load(); } },
    h("option", { value: "" }, "전체 상태"),
    ...COLUMNS.map(s => h("option", { value: s, selected: s === statusFilter }, statusMeta(s).ko)));
  return sel;
}

async function load() {
  const body = document.getElementById("track-body");
  if (!body) return;
  mount(body, h("div", { class: "mt-2" }, skeletonGrid(4)));
  try {
    if (tab === "board") {
      const res = await api.trackRequests({ status: statusFilter || undefined, per_page: 100 });
      mount(body, board(res.results || []));
    } else {
      const res = await api.conflicts({ per_page: 100 });
      mount(body, conflicts(res.results || [], res.total || 0));
    }
  } catch (err) { mount(body, errorState(err, load)); }
}

/* ---------- board ---------- */
function board(rows) {
  if (!rows.length) {
    return emptyState({ title: "표시할 협찬 요청이 없습니다",
      body: statusFilter ? "이 상태의 요청이 없습니다. 필터를 ‘전체 상태’로 바꿔보세요." : "ON Sourcing 또는 ON Sponsor에서 협찬 요청을 생성해 보세요.",
      ico: "layers" });
  }
  const groups = Object.fromEntries(COLUMNS.map(c => [c, []]));
  for (const r of rows) (groups[r.status] || (groups[r.status] = [])).push(r);
  const cols = (statusFilter ? [statusFilter] : COLUMNS).map(status => column(status, groups[status] || []));
  return h("div", { class: "flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1" }, ...cols);
}

function column(status, items) {
  const m = statusMeta(status);
  return h("div", { class: "shrink-0 w-[280px] flex flex-col" },
    h("div", { class: "flex items-center justify-between mb-3 px-1" },
      h("div", { class: "flex items-center gap-2 font-extrabold tracking-tight text-[14px]", style: { color: m.hue } },
        h("span", { class: "w-2.5 h-2.5 rounded-full", style: { background: m.hue } }), m.ko),
      h("span", { class: "mono text-[12px] font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5" }, String(items.length))),
    h("div", { class: "flex flex-col gap-3" },
      items.length ? items.map(trackCard) : h("div", { class: "rounded-2xl border border-dashed border-slate-200 py-8 text-center text-[12.5px] text-slate-300" }, "비어 있음")));
}

function trackCard(r) {
  const g = r.garment || { name: r.garment_id, brand: "", category: "accessory", color: "" };
  const m = statusMeta(r.status);
  const next = NEXT[r.status] || [];

  return h("article", { class: "rounded-2xl border border-slate-100 bg-white shadow-card p-3.5 border-l-4", style: { borderLeftColor: m.hue } },
    h("div", { class: "flex items-center gap-3" },
      h("div", { class: "w-12 shrink-0" }, swatch(g, { square: true })),
      h("div", { class: "min-w-0" },
        h("div", { class: "font-extrabold tracking-tight text-slate-800 text-[14px] truncate" }, g.name),
        h("div", { class: "text-[12px] text-slate-500 truncate" }, brandName(r.brand_id), " · ", celebName(r.celebrity_id)))),
    h("div", { class: "flex items-center justify-between gap-2 mt-3" },
      ddayBadge(r.d_day, r.status),
      h("span", { class: "mono text-[10.5px] text-slate-300 truncate" }, r.id)),
    (r.pickup_date || r.return_date) ? h("div", { class: "flex items-center gap-1.5 mt-2 text-[12px] text-slate-500 mono" },
      icon("arrowRight", { size: 12 }),
      h("span", null, r.pickup_date || "—", " → ", r.return_date || "—")) : null,
    r.requester_stylist_id ? h("div", { class: "mt-1.5 text-[12px] text-slate-400" }, "요청자 ", h("span", { class: "mono text-slate-500" }, r.requester_stylist_id)) : null,
    r.notes ? h("div", { class: "mt-1.5 text-[12px] text-slate-500 leading-snug whitespace-pre-wrap" }, truncate(r.notes, 120)) : null,
    next.length ? h("div", { class: "flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100" },
      ...next.map(t => h("button", { class: `btn btn-sm ${TARGET[t].cls}`, onclick: () => confirmTransition(r, t) }, TARGET[t].ko))) : null);
}

function confirmTransition(r, target) {
  const notes = h("textarea", { id: "tr-notes", rows: 2, placeholder: "전이 사유·메모 (선택)" }, "");
  const goBtn = h("button", { class: "btn btn-signal" }, "전이 실행");

  const ctl = modal({
    title: "상태 전이", sub: `요청 ${r.id}`,
    body: h("div", { class: "flex flex-col gap-4" },
      h("div", { class: "flex items-center gap-3" }, statusPill(r.status), icon("arrowRight", { size: 18, cls: "text-slate-300" }), statusPill(target)),
      h("div", { class: "flex items-center justify-between text-[13px]" },
        h("span", { class: "text-slate-400" }, "가먼트"), h("span", { class: "font-semibold text-slate-700" }, r.garment?.name || r.garment_id)),
      h("div", { class: "field" }, h("label", { for: "tr-notes" }, "메모"), notes)),
    footer: [h("button", { class: "btn btn-ghost", onclick: () => ctl.close() }, "취소"), goBtn],
  });

  goBtn.addEventListener("click", async () => {
    goBtn.disabled = true; goBtn.replaceChildren(h("span", { class: "spin on-dark" }), "전이 중…");
    try {
      const out = await api.transition(r.id, { target_status: target, notes: notes.value.trim() || undefined });
      ctl.close();
      toast(`${r.id} → ${statusMeta(out.status).ko}`, { type: "ok", title: "상태 전이 완료" });
      load();
    } catch (err) {
      goBtn.disabled = false; goBtn.replaceChildren("전이 실행");
      if (err instanceof ApiError && err.status === 409 && err.detail && typeof err.detail === "object") {
        const allowed = (err.detail.allowed || []).map(s => statusMeta(s).ko).join(", ") || "없음";
        toast(`현재 ‘${statusMeta(err.detail.current_status).ko}’ 상태에서는 허용되지 않는 전이입니다. 가능한 전이: ${allowed}`,
          { type: "bad", title: "전이 충돌 (409)", timeout: 6000 });
      } else toast(err.message || "전이 실패", { type: "bad", title: "전이 실패" });
    }
  });
}

/* ---------- conflicts ---------- */
function conflicts(rows, total) {
  if (!rows.length) {
    return emptyState({ title: "감지된 충돌이 없습니다",
      body: "활성 상태(requested · reserved · picked_up)의 요청이 동일 재고에서 일정이 겹치면 여기에 표시됩니다.", ico: "checkCircle" });
  }
  const head = h("div", { class: "flex items-center justify-between gap-3 mb-4" },
    h("div", { class: "text-sm text-slate-500" }, h("b", { class: "text-slate-800" }, String(total)), "건의 조율 필요 충돌"),
    h("span", { class: "pill warn" }, h("span", { class: "pdot" }), "coordination needed"));
  return h("div", null, head, h("div", { class: "grid md:grid-cols-2 gap-4" }, ...rows.map(conflictCard)));
}

function conflictCard(c) {
  const g = c.garment || { name: c.inventory_id, brand: "", category: "accessory", color: "" };
  return h("div", { class: "rounded-3xl border border-amber-100 bg-white shadow-card p-5" },
    h("div", { class: "flex items-center gap-3" },
      h("div", { class: "w-11 shrink-0" }, swatch(g, { square: true })),
      h("div", { class: "min-w-0" },
        h("div", { class: "font-extrabold tracking-tight text-slate-800 truncate" }, g.name),
        h("div", { class: "mono text-[11px] text-slate-400" }, c.inventory_id))),
    h("div", { class: "flex items-start gap-2 mt-3 p-3 rounded-xl bg-amber-50 text-[13px] text-amber-800" },
      icon("warn", { size: 16, cls: "shrink-0 mt-0.5" }), h("span", null, c.message)),
    h("div", { class: "flex items-stretch gap-2 mt-3" },
      conflictSide("A", c.request_a),
      h("div", { class: "flex items-center text-[12px] font-bold text-slate-300" }, "vs"),
      conflictSide("B", c.request_b)));
}
function conflictSide(label, r) {
  if (!r) return h("div", { class: "flex-1 rounded-xl bg-slate-50 p-3 text-slate-300" }, "—");
  return h("div", { class: "flex-1 rounded-xl bg-slate-50 p-3 flex flex-col gap-1.5" },
    h("div", { class: "flex items-center justify-between gap-2" },
      h("span", { class: "text-[12px] font-bold text-slate-600" }, `요청 ${label}`), statusPill(r.status)),
    h("div", { class: "mono text-[11px] text-slate-400 truncate" }, r.id),
    csRow("일정", (r.pickup_date || "—") + " → " + (r.return_date || "—")),
    csRow("요청자", r.requester_stylist_id || "—"),
    r.notes ? csRow("메모", truncate(r.notes, 60)) : null);
}
function csRow(k, v) {
  return h("div", { class: "flex gap-2 text-[12px]" }, h("span", { class: "text-slate-400 w-10 shrink-0" }, k), h("span", { class: "text-slate-600 truncate" }, v));
}

function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + "…" : s; }
