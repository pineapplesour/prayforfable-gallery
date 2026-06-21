// ON Track — sponsorship board grouped by status with D-day, state-machine
// transitions, and a conflicts view (overlapping holds on the same inventory).
import { h, icon, mount, swatch, statusMeta, statusPill, ddayBadge, errorState, emptyState, skeletonGrid } from "../ui.js";
import { api, ApiError } from "../api.js";
import { celebName, brandName } from "../catalog.js";
import { modal, toast } from "../overlay.js";

const COLUMNS = ["candidate", "requested", "reserved", "picked_up", "returned", "rejected"];

// Allowed transitions (mirrors backend state machine).
const NEXT = {
  candidate: ["requested", "rejected"],
  requested: ["reserved", "rejected"],
  reserved:  ["picked_up", "rejected"],
  picked_up: ["returned"],
  returned:  [],
  rejected:  [],
};
const TARGET = {
  requested: { ko: "요청으로", cls: "btn-soft" },
  reserved:  { ko: "예약 확정", cls: "btn-soft" },
  picked_up: { ko: "픽업 처리", cls: "btn-soft" },
  returned:  { ko: "반납 처리", cls: "btn-primary" },
  rejected:  { ko: "거절", cls: "btn-ghost" },
};

let tab = "board";   // board | conflicts
let statusFilter = "";

export default {
  async render(root) {
    mount(root, shell());
    load();
    return () => {};
  },
};

function shell() {
  return h("section", { class: "view" },
    h("header", { class: "view-head" },
      h("div", { class: "eyebrow" }, "ON TRACK · 03"),
      h("h1", { class: "view-title" }, "협찬 ", h("em", null, "진행"), "을 한 화면에서"),
      h("p", { class: "view-lede" }, "후보부터 반납까지 상태별 보드로 추적하고, 상태 전이는 검증된 상태 머신을 따릅니다. 동일 재고의 일정 충돌도 자동 감지합니다.")),
    h("div", { class: "track-toolbar" },
      h("div", { class: "track-tabs", role: "tablist" },
        tabBtn("board", "보드"),
        tabBtn("conflicts", "충돌 감지")),
      h("div", { class: "row", style: { gap: "10px" } },
        tab === "board" ? statusFilterSel() : null,
        h("button", { class: "btn btn-ghost btn-sm", onclick: load }, icon("refresh", { size: 14 }), "새로고침"))),
    h("div", { id: "track-body" }));
}

function tabBtn(id, label) {
  return h("button", { class: tab === id ? "is-active" : "", role: "tab",
    onclick: () => { if (tab !== id) { tab = id; mount(document.getElementById("main"), shell()); load(); } } }, label);
}
function statusFilterSel() {
  const sel = h("select", { class: "btn-sm", style: { width: "auto", padding: "7px 30px 7px 12px" },
    onchange: () => { statusFilter = sel.value; load(); } },
    h("option", { value: "" }, "전체 상태"),
    ...COLUMNS.map(s => h("option", { value: s, selected: s === statusFilter }, statusMeta(s).ko)));
  return sel;
}

async function load() {
  const body = document.getElementById("track-body");
  if (!body) return;
  mount(body, h("div", { style: { marginTop: "6px" } }, skeletonGrid(4)));
  try {
    if (tab === "board") {
      const res = await api.trackRequests({ status: statusFilter || undefined, per_page: 100 });
      mount(body, board(res.results || []));
    } else {
      const res = await api.conflicts({ per_page: 100 });
      mount(body, conflicts(res.results || [], res.total || 0));
    }
  } catch (err) {
    mount(body, errorState(err, load));
  }
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
  return h("div", { class: "board" }, ...cols);
}

function column(status, items) {
  const m = statusMeta(status);
  return h("div", { class: "col", style: { } },
    h("div", { class: "col-head", style: { borderColor: m.hue } },
      h("div", { class: "ch-name", style: { color: m.hue } }, h("span", { class: "pdot", style: { width: "8px", height: "8px", borderRadius: "50%", background: m.hue, display: "inline-block" } }), m.ko),
      h("span", { class: "ch-count" }, String(items.length))),
    h("div", { class: "col-body" },
      items.length ? items.map(trackCard) : h("div", { class: "col-empty" }, "비어 있음")));
}

function trackCard(r) {
  const g = r.garment || { name: r.garment_id, brand: "", category: "accessory", color: "" };
  const m = statusMeta(r.status);
  const next = NEXT[r.status] || [];

  return h("article", { class: "tcard", style: { borderLeftColor: m.hue } },
    h("div", { class: "tcard-top" },
      h("div", { class: "swatch", style: { width: "52px" } }, swatch(g, { square: true })),
      h("div", { class: "tcard-info" },
        h("div", { class: "tcard-name" }, g.name),
        h("div", { class: "tcard-sub" }, brandName(r.brand_id), " · ", celebName(r.celebrity_id)))),
    h("div", { class: "row", style: { justifyContent: "space-between", gap: "8px" } },
      ddayBadge(r.d_day, r.status),
      h("span", { class: "mono muted", style: { fontSize: "10.5px" } }, r.id)),
    (r.pickup_date || r.return_date) ? h("div", { class: "tcard-dates" },
      icon("arrowRight", { size: 12 }),
      h("span", null, r.pickup_date || "—", " → ", r.return_date || "—")) : null,
    r.requester_stylist_id ? h("div", { class: "tcard-meta" }, h("span", null, "요청자 ", h("span", { class: "id" }, r.requester_stylist_id))) : null,
    r.notes ? h("div", { class: "muted", style: { fontSize: "12px", whiteSpace: "pre-wrap" } }, truncate(r.notes, 120)) : null,
    next.length ? h("div", { class: "tcard-actions" },
      ...next.map(t => h("button", { class: `btn btn-sm ${TARGET[t].cls}`,
        onclick: () => confirmTransition(r, t) }, TARGET[t].ko))) : null);
}

function confirmTransition(r, target) {
  const tm = statusMeta(target);
  const notes = h("textarea", { id: "tr-notes", placeholder: "전이 사유·메모 (선택)" }, "");
  const goBtn = h("button", { class: "btn btn-signal" }, "전이 실행");

  const ctl = modal({
    title: "상태 전이",
    sub: `요청 ${r.id}`,
    body: h("div", { style: { display: "flex", flexDirection: "column", gap: "16px" } },
      h("div", { class: "row", style: { gap: "12px", alignItems: "center" } },
        statusPill(r.status), icon("arrowRight", { size: 18, cls: "muted" }), statusPill(target)),
      h("div", { class: "kv" }, h("span", { class: "k" }, "가먼트"), h("span", null, r.garment?.name || r.garment_id)),
      h("div", { class: "field" }, h("label", { for: "tr-notes" }, "메모"), notes)),
    footer: [h("button", { class: "btn btn-ghost", onclick: () => ctl.close() }, "취소"), goBtn],
  });

  goBtn.addEventListener("click", async () => {
    goBtn.disabled = true; goBtn.replaceChildren(h("span", { class: "spin" }), "전이 중…");
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
      } else {
        toast(err.message || "전이 실패", { type: "bad", title: "전이 실패" });
      }
    }
  });
}

/* ---------- conflicts ---------- */
function conflicts(rows, total) {
  if (!rows.length) {
    return emptyState({ title: "감지된 충돌이 없습니다",
      body: "활성 상태(requested · reserved · picked_up)의 요청이 동일 재고에서 일정이 겹치면 여기에 표시됩니다.",
      ico: "checkCircle" });
  }
  const head = h("div", { class: "results-meta" },
    h("div", { class: "count" }, h("b", null, String(total)), "건의 조율 필요 충돌"),
    h("span", { class: "pill warn" }, h("span", { class: "pdot" }), "coordination needed"));
  return h("div", null, head, h("div", { class: "conflict-list" }, ...rows.map(conflictCard)));
}

function conflictCard(c) {
  const g = c.garment || { name: c.inventory_id, brand: "", category: "accessory", color: "" };
  return h("div", { class: "conflict" },
    h("div", { class: "conflict-head" },
      h("div", { class: "swatch", style: { width: "44px" } }, swatch(g, { square: true })),
      h("div", null,
        h("div", { class: "ctitle" }, g.name),
        h("div", { class: "cinv mono" }, c.inventory_id))),
    h("div", { class: "conflict-msg" }, icon("warn", { size: 16 }), h("span", null, c.message)),
    h("div", { class: "conflict-pair" },
      conflictSide("A", c.request_a),
      h("div", { class: "conflict-vs" }, "vs"),
      conflictSide("B", c.request_b)));
}

function conflictSide(label, r) {
  if (!r) return h("div", { class: "conflict-side" }, "—");
  return h("div", { class: "conflict-side" },
    h("div", { class: "row", style: { justifyContent: "space-between" } },
      h("span", { class: "cs-id" }, `요청 ${label}`), statusPill(r.status)),
    h("div", { class: "cs-id mono" }, r.id),
    h("div", { class: "cs-row" }, h("span", { class: "k" }, "일정"),
      h("span", null, (r.pickup_date || "—") + " → " + (r.return_date || "—"))),
    h("div", { class: "cs-row" }, h("span", { class: "k" }, "요청자"), h("span", null, r.requester_stylist_id || "—")),
    r.notes ? h("div", { class: "cs-row muted" }, h("span", { class: "k" }, "메모"), h("span", null, truncate(r.notes, 80))) : null);
}

function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + "…" : s; }
