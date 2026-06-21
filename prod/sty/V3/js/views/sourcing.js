// ON Sourcing — mood/concept + filters -> ranked garment cards with availability.
import { h, icon, catIcon, swatch, chip, mount, skeletonGrid, emptyState, errorState, fmtKRW } from "../ui.js";
import { CATEGORIES, SEASONS, SIZES } from "../config.js";
import { api } from "../api.js";
import { openRequestModal } from "../requestModal.js";

const EXAMPLES = [
  "미니멀 시티 오피스 트렌치",
  "모노크롬 인텔렉추얼 레이어드",
  "코지 위켄드 아카데미아 니트",
  "샤프한 테일러드 블랙 재킷",
  "아메리카나 캐주얼 데님",
];

const PER_PAGE = 12;
let state = { q: "미니멀 시티 오피스 트렌치", category: "", season: "", size: "", page: 1, total: 0, results: null, loading: false, err: null };

export default {
  async render(root) {
    mount(root, view());
    // auto-run a first search so the screen is alive with real data
    runSearch(1);
    return () => {};
  },
};

function view() {
  const moodInput = h("textarea", { id: "src-mood", class: "control", rows: 2,
    placeholder: "무드·컨셉을 자유롭게 적어주세요 — 예: 미니멀 시티 오피스 트렌치", maxlength: 500 }, state.q);

  const catSel = sel("src-cat", CATEGORIES.map(c => ({ v: c.id, t: c.label })), state.category);
  const seaSel = sel("src-season", SEASONS.map(s => ({ v: s.id, t: s.label })), state.season);
  const sizeSel = sel("src-size", SIZES.map(s => ({ v: s, t: s || "전체 사이즈" })), state.size);

  // ★ V3 variation: actions live in a right-hand VERTICAL action rail.
  const submit = h("button", { class: "btn btn-signal", id: "src-go",
    onclick: () => { state.q = moodInput.value; runSearch(1); } },
    icon("search", { size: 16 }), "소싱하기");
  const applyFilters = h("button", { class: "btn btn-ghost", id: "src-apply",
    onclick: () => { state.q = moodInput.value; runSearch(1); } },
    icon("layers", { size: 15 }), "필터 적용");
  const resetFilters = h("button", { class: "btn btn-soft", id: "src-reset",
    onclick: () => {
      state.category = ""; state.season = ""; state.size = "";
      catSel.value = ""; seaSel.value = ""; sizeSel.value = "";
      runSearch(1);
    } },
    icon("refresh", { size: 15 }), "필터 초기화");

  const rail = h("div", { class: "action-rail railed" },
    h("div", { class: "rail-label" }, "Actions"),
    submit,
    applyFilters,
    resetFilters,
    h("p", { class: "rail-note" }, "무드와 필터를 조합해\n협찬 가능한 재고를 랭킹합니다."));

  const form = h("div", { class: "panel panel-pad sourcing-search" },
    h("div", { class: "mood-row" },
      h("div", { class: "mood-main" },
        h("div", { class: "field" },
          h("label", { for: "src-mood" }, "무드 · 컨셉"),
          moodInput,
          h("div", { class: "example-chips" },
            ...EXAMPLES.map(ex => chip(ex, { onClick: () => { moodInput.value = ex; state.q = ex; runSearch(1); } })))),
        h("div", { class: "form-grid" },
          field("카테고리", catSel),
          field("시즌", seaSel),
          field("사이즈", sizeSel))),
      rail));

  // capture selects into state on change
  catSel.addEventListener("change", () => state.category = catSel.value);
  seaSel.addEventListener("change", () => state.season = seaSel.value);
  sizeSel.addEventListener("change", () => state.size = sizeSel.value);
  moodInput.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { state.q = moodInput.value; runSearch(1); }
  });

  return h("section", { class: "view" },
    h("header", { class: "view-head" },
      h("div", { class: "eyebrow" }, "ON SOURCING · 01"),
      h("h1", { class: "view-title" }, "무드를 ", h("em", null, "재고"), "로 연결합니다"),
      h("p", { class: "view-lede" }, "컨셉 문장과 필터만 입력하면, 규칙 기반 랭킹이 협찬 가능한 실제 재고·쇼룸·픽업 여부까지 함께 제시합니다.")),
    form,
    h("div", { id: "src-results" }));
}

async function runSearch(page) {
  state.page = page; state.loading = true; state.err = null;
  paintResults();
  const payload = { mood_text: (state.q || "").trim() || "editorial", page, per_page: PER_PAGE };
  if (state.category) payload.category = state.category;
  if (state.season) payload.season = state.season;
  if (state.size) payload.size = state.size;
  try {
    const res = await api.sourcingSearch(payload);
    state.results = res.results || [];
    state.total = res.total || 0;
    state.loading = false;
    paintResults();
  } catch (err) {
    state.loading = false; state.err = err; state.results = null;
    paintResults();
  }
}

function paintResults() {
  const box = document.getElementById("src-results");
  if (!box) return;
  if (state.loading) { mount(box, h("div", { style: { marginTop: "30px" } }, skeletonGrid(6))); return; }
  if (state.err) { mount(box, h("div", { style: { marginTop: "30px" } }, errorState(state.err, () => runSearch(state.page)))); return; }

  const totalPages = Math.max(1, Math.ceil(state.total / PER_PAGE));
  const meta = h("div", { class: "results-meta" },
    h("div", { class: "count" }, "총 ", h("b", null, String(state.total)), "개 결과 · ", h("span", { class: "muted" }, `${state.page} / ${totalPages} 페이지`)),
    h("div", { class: "row", style: { gap: "8px" } },
      pageBtn("‹ 이전", state.page <= 1, () => runSearch(state.page - 1)),
      pageBtn("다음 ›", state.page >= totalPages, () => runSearch(state.page + 1))));

  if (!state.results || !state.results.length) {
    mount(box, h("div", { style: { marginTop: "30px" } }, meta,
      emptyState({ title: "조건에 맞는 결과가 없습니다", body: "무드 문장을 바꾸거나 필터를 완화해 보세요.", ico: "search" })));
    return;
  }

  const grid = h("div", { class: "garment-grid" }, ...state.results.map((r, i) => garmentCard(r, i)));
  mount(box, h("div", { style: { marginTop: "30px" } }, meta, grid));
}

function garmentCard(result, idx) {
  const { garment: g, inventory = [], score, reasons = [] } = result;
  const rank = (state.page - 1) * PER_PAGE + idx + 1;

  const sw = swatch(g);
  sw.append(h("span", { class: "gcard-rank" }, `#${rank}`, h("span", { class: "score" }, ` ${score}`)));

  const reservable = inventory.filter(i => i.reservable && i.stock_count > 0);
  const availBlock = inventory.length
    ? h("div", { class: "availability" },
        h("div", { class: "avail-row wrap" },
          ...dedupeSizes(inventory).map(i =>
            h("span", { class: "size-stock" + (i.reservable && i.stock_count > 0 ? "" : " soft") },
              i.reservable && i.stock_count > 0 ? h("span", { class: "badge-dot r" }) : null,
              i.pickup_available ? h("span", { class: "badge-dot p" }) : null,
              h("span", { class: "sz" }, i.size), h("span", { class: "muted" }, ` ×${i.stock_count}`)))),
        showroomLine(inventory))
    : h("div", { class: "availability" }, h("div", { class: "avail-row none" }, "연결된 재고 없음"));

  return h("article", { class: "gcard" },
    sw,
    h("div", { class: "gcard-body" },
      h("div", { class: "gcard-head" },
        h("div", null,
          h("div", { class: "gcard-brand" }, g.brand),
          h("h3", { class: "gcard-name" }, g.name)),
        h("div", { class: "gcard-price" }, fmtKRW(g.price_krw))),
      h("div", { class: "gcard-tags" }, ...g.mood_tags.slice(0, 4).map(t => chip(t, { tag: true }))),
      reasons.length ? h("ul", { class: "reasons" },
        h("li", { class: "rh", style: { display: "block" } }, "왜 추천하나요"),
        ...reasons.slice(0, 4).map(rs => h("li", null, rs))) : null,
      availBlock),
    h("div", { class: "gcard-actions" },
      h("button", { class: "btn btn-soft btn-sm", style: { flex: "1" },
        onclick: () => openRequestModal({ garment: g, inventory: reservable.length ? reservable : inventory }) },
        icon("arrowRight", { size: 14 }), "협찬 요청"),
      h("a", { class: "btn btn-ghost btn-sm", href: `#/sponsor?garment=${encodeURIComponent(g.id)}&brand=${encodeURIComponent(g.brand)}` },
        "스폰서 확인")));
}

/* helpers */
function dedupeSizes(inv) {
  const seen = new Map();
  for (const i of inv) {
    const prev = seen.get(i.size);
    if (!prev || (i.reservable && i.stock_count > 0)) seen.set(i.size, i);
  }
  return [...seen.values()];
}
function showroomLine(inv) {
  const names = [...new Set(inv.map(i => i.showroom?.name).filter(Boolean))];
  if (!names.length) return null;
  const loc = inv.find(i => i.showroom?.location)?.showroom?.location || "";
  return h("div", { class: "showroom-line" }, icon("pin", { size: 13 }),
    h("span", null, names[0], loc ? h("span", { class: "muted" }, ` · ${loc}`) : null,
      names.length > 1 ? h("span", { class: "muted" }, ` 외 ${names.length - 1}곳`) : null));
}
function sel(id, opts, value) {
  return h("select", { id }, ...opts.map(o => h("option", { value: o.v, selected: o.v === value }, o.t)));
}
function field(label, control) {
  return h("div", { class: "field" }, h("label", { for: control.id }, label), control);
}
function pageBtn(label, disabled, onClick) {
  return h("button", { class: "btn btn-ghost btn-sm", disabled, onclick: onClick }, label);
}
