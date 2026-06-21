// ON Ref — concept/mood reference search -> ranked reference decks + matched garments.
// POST /api/ref/search.  Re:Connect 룩 — sourcing 의 hero/카드 헬퍼 재사용.
import { h, icon, chip, mount, skeletonGrid, emptyState, errorState, fmtKRW } from "../ui.js";
import { api } from "../api.js";
import { openRequestModal } from "../requestModal.js";
import { hero, garmentCardBase, reasonsList, pageBtn } from "./sourcing.js";

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

  const submit = h("button", { class: "btn btn-primary w-full sm:w-auto self-stretch sm:self-end", id: "ref-go",
    onclick: () => { state.q = moodInput.value; runSearch(1); } },
    icon("search", { size: 16 }), "레퍼런스 검색");

  moodInput.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { state.q = moodInput.value; runSearch(1); }
  });

  const form = h("div", { class: "rounded-[2rem] border border-slate-100 bg-white shadow-soft p-6 sm:p-7" },
    h("div", { class: "flex flex-col sm:flex-row gap-4 sm:items-end" },
      h("div", { class: "field flex-1" },
        h("label", { for: "ref-mood" }, "레퍼런스 무드 · 컨셉"),
        moodInput),
      submit),
    h("div", { class: "flex flex-wrap gap-2 mt-3" },
      ...EXAMPLES.map(ex => chip(ex, { onClick: () => { moodInput.value = ex; state.q = ex; runSearch(1); } }))));

  return h("div", null,
    hero({
      eyebrow: "ON REF · 05",
      title: "레퍼런스를", em: "실물로 매칭합니다",
      lede: "에디토리얼 레퍼런스 덱과 무드를 입력하면, 가장 가까운 실제 카탈로그 가먼트를 랭킹과 근거와 함께 제시합니다.",
    }),
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
  if (state.loading) { mount(box, h("div", { class: "mt-8" }, skeletonGrid(6))); return; }
  if (state.err) { mount(box, h("div", { class: "mt-8" }, errorState(state.err, () => runSearch(state.page)))); return; }

  const totalPages = Math.max(1, Math.ceil(state.total / PER_PAGE));
  const meta = h("div", { class: "flex items-center justify-between gap-3 mt-2" },
    h("div", { class: "text-sm text-slate-500" }, "총 ", h("b", { class: "text-slate-800" }, String(state.total)), "개 레퍼런스 매칭 · ",
      h("span", { class: "text-slate-400" }, `${state.page} / ${totalPages} 페이지`)),
    h("div", { class: "flex gap-2" },
      pageBtn("‹ 이전", state.page <= 1, () => runSearch(state.page - 1)),
      pageBtn("다음 ›", state.page >= totalPages, () => runSearch(state.page + 1))));

  if (!state.results || !state.results.length) {
    mount(box, h("div", { class: "mt-8" }, meta,
      emptyState({ title: "매칭되는 레퍼런스가 없습니다", body: "무드 문장을 바꿔서 다시 검색해 보세요.", ico: "search" })));
    return;
  }

  const grid = h("div", { class: "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mt-6" }, ...state.results.map((r, i) => refCard(r, i)));
  const seam = state.seam ? seamNote(state.seam) : null;
  mount(box, h("div", { class: "mt-8" }, meta, grid, seam));
}

function refCard(result, idx) {
  const { garment: g, reference_id, source_title, score, reasons = [] } = result;
  const rank = (state.page - 1) * PER_PAGE + idx + 1;
  const sw = garmentCardBase(g, { rank, score });

  return h("article", { class: "group rounded-3xl border border-slate-100 bg-white shadow-card hover:shadow-soft hover:-translate-y-1 transition-all duration-200 overflow-hidden flex flex-col" },
    h("div", { class: "relative overflow-hidden group-hover:[&_img]:scale-105 [&_img]:transition-transform [&_img]:duration-300" }, sw),
    h("div", { class: "p-5 flex-1 flex flex-col" },
      h("div", { class: "inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-600 bg-brand-50 rounded-full px-2.5 py-1 self-start mb-2" },
        icon("layers", { size: 12 }), source_title || reference_id),
      h("div", { class: "flex items-start justify-between gap-3" },
        h("div", { class: "min-w-0" },
          h("div", { class: "text-[11px] font-bold uppercase tracking-wide text-brand-600" }, g.brand),
          h("h3", { class: "font-extrabold tracking-tight text-slate-800 leading-snug" }, g.name)),
        h("div", { class: "mono text-[13px] font-bold text-slate-700 shrink-0" }, fmtKRW(g.price_krw))),
      h("div", { class: "flex flex-wrap gap-1.5 mt-3" }, ...(g.mood_tags || []).slice(0, 4).map(t => chip(t, { tag: true }))),
      reasons.length ? reasonsList("왜 이 레퍼런스인가요", reasons) : null,
      h("div", { class: "mono text-[11px] text-slate-300 mt-3" }, reference_id)),
    h("div", { class: "px-5 pb-5 flex gap-2" },
      h("button", { class: "btn btn-soft btn-sm flex-1", onclick: () => openRequestModal({ garment: g }) },
        icon("arrowRight", { size: 14 }), "협찬 요청"),
      h("a", { class: "btn btn-ghost btn-sm", href: `#/sponsor?garment=${encodeURIComponent(g.id)}&brand=${encodeURIComponent(g.brand)}` },
        "스폰서 확인")));
}

function seamNote(text) {
  return h("p", { class: "flex items-center gap-2 mt-5 text-[12.5px] text-slate-400" }, icon("info", { size: 13 }), text);
}
