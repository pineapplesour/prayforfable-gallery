// ON Ref — concept/mood reference search -> ranked reference decks + matched
// garments. Wired to the LIVE backend: POST /api/ref/search.
import { h, icon, swatch, chip, mount, skeletonGrid, emptyState, errorState, fmtKRW } from "../ui.js";
import { api } from "../api.js";
import { openRequestModal } from "../requestModal.js";

const EXAMPLES = [
  "quiet luxury city trench",
  "monochrome rib knit editorial",
  "americana light denim",
  "soft tailored office layering",
];

const PER_PAGE = 12;
let state = { q: "quiet luxury city trench", page: 1, total: 0, results: null, loading: false, err: null, seam: "" };

export default {
  async render(root) {
    mount(root, view());
    runSearch(1);
    return () => {};
  },
};

function view() {
  const moodInput = h("textarea", { id: "ref-mood", class: "control", rows: 2,
    placeholder: "레퍼런스 무드·컨셉을 적어주세요 — 예: quiet luxury city trench", maxlength: 500 }, state.q);

  const submit = h("button", { class: "btn btn-primary", id: "ref-go", style: { height: "fit-content" },
    onclick: () => { state.q = moodInput.value; runSearch(1); } },
    icon("search", { size: 16 }), "레퍼런스 검색");

  moodInput.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { state.q = moodInput.value; runSearch(1); }
  });

  const form = h("div", { class: "panel panel-pad sourcing-search" },
    h("div", { class: "mood-row" },
      h("div", { class: "field" },
        h("label", { for: "ref-mood" }, "레퍼런스 무드 · 컨셉"),
        moodInput,
        h("div", { class: "example-chips" },
          ...EXAMPLES.map(ex => chip(ex, { onClick: () => { moodInput.value = ex; state.q = ex; runSearch(1); } })))),
      submit));

  return h("section", { class: "view" },
    h("header", { class: "view-head" },
      h("div", { class: "eyebrow" }, "ON REF · 05"),
      h("h1", { class: "view-title" }, "레퍼런스를 ", h("em", null, "실물"), "로 매칭합니다"),
      h("p", { class: "view-lede" }, "에디토리얼 레퍼런스 덱과 무드를 입력하면, 가장 가까운 실제 카탈로그 가먼트를 랭킹과 근거와 함께 제시합니다.")),
    form,
    h("div", { id: "ref-results" }));
}

async function runSearch(page) {
  state.page = page; state.loading = true; state.err = null;
  paintResults();
  const payload = { mood_text: (state.q || "").trim() || "editorial", page, per_page: PER_PAGE };
  try {
    const res = await api.refSearch(payload);
    state.results = res.results || [];
    state.total = res.total || 0;
    state.seam = res.model_seam || "";
    state.loading = false;
    paintResults();
  } catch (err) {
    state.loading = false; state.err = err; state.results = null;
    paintResults();
  }
}

function paintResults() {
  const box = document.getElementById("ref-results");
  if (!box) return;
  if (state.loading) { mount(box, h("div", { style: { marginTop: "30px" } }, skeletonGrid(6))); return; }
  if (state.err) { mount(box, h("div", { style: { marginTop: "30px" } }, errorState(state.err, () => runSearch(state.page)))); return; }

  const totalPages = Math.max(1, Math.ceil(state.total / PER_PAGE));
  const meta = h("div", { class: "results-meta" },
    h("div", { class: "count" }, "총 ", h("b", null, String(state.total)), "개 레퍼런스 매칭 · ",
      h("span", { class: "muted" }, `${state.page} / ${totalPages} 페이지`)),
    h("div", { class: "row", style: { gap: "8px" } },
      pageBtn("‹ 이전", state.page <= 1, () => runSearch(state.page - 1)),
      pageBtn("다음 ›", state.page >= totalPages, () => runSearch(state.page + 1))));

  if (!state.results || !state.results.length) {
    mount(box, h("div", { style: { marginTop: "30px" } }, meta,
      emptyState({ title: "매칭되는 레퍼런스가 없습니다", body: "무드 문장을 바꿔서 다시 검색해 보세요.", ico: "search" })));
    return;
  }

  const grid = h("div", { class: "garment-grid" }, ...state.results.map((r, i) => refCard(r, i)));
  const seam = state.seam ? h("p", { class: "seam-note" }, icon("info", { size: 13 }), state.seam) : null;
  mount(box, h("div", { style: { marginTop: "30px" } }, meta, grid, seam));
}

function refCard(result, idx) {
  const { garment: g, reference_id, source_title, score, reasons = [] } = result;
  const rank = (state.page - 1) * PER_PAGE + idx + 1;

  const sw = swatch(g);
  sw.append(h("span", { class: "gcard-rank" }, `#${rank}`, h("span", { class: "score" }, ` ${score}`)));

  return h("article", { class: "gcard" },
    sw,
    h("div", { class: "gcard-body" },
      h("div", { class: "ref-source" },
        icon("layers", { size: 13 }),
        h("span", null, source_title || reference_id)),
      h("div", { class: "gcard-head" },
        h("div", null,
          h("div", { class: "gcard-brand" }, g.brand),
          h("h3", { class: "gcard-name" }, g.name)),
        h("div", { class: "gcard-price" }, fmtKRW(g.price_krw))),
      h("div", { class: "gcard-tags" }, ...(g.mood_tags || []).slice(0, 4).map(t => chip(t, { tag: true }))),
      reasons.length ? h("ul", { class: "reasons" },
        h("li", { class: "rh", style: { display: "block" } }, "왜 이 레퍼런스인가요"),
        ...reasons.slice(0, 4).map(rs => h("li", null, rs))) : null,
      h("div", { class: "ref-id mono muted" }, reference_id)),
    h("div", { class: "gcard-actions" },
      h("button", { class: "btn btn-soft btn-sm", style: { flex: "1" },
        onclick: () => openRequestModal({ garment: g }) },
        icon("arrowRight", { size: 14 }), "협찬 요청"),
      h("a", { class: "btn btn-ghost btn-sm", href: `#/sponsor?garment=${encodeURIComponent(g.id)}&brand=${encodeURIComponent(g.brand)}` },
        "스폰서 확인")));
}

function pageBtn(label, disabled, onClick) {
  return h("button", { class: "btn btn-ghost btn-sm", disabled, onclick: onClick }, label);
}
