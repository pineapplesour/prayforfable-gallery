// ON Sourcing — mood/concept + filters -> ranked garment cards with availability.
// Re:Connect 룩: hero(그라데이션 헤드라인 + pill 배지 + 플로팅 목업 카드) + 둥근 글래스 카드.
import { h, icon, swatch, chip, mount, skeletonGrid, emptyState, errorState, fmtKRW } from "../ui.js";
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
    runSearch(1);
    return () => {};
  },
};

/* ---------- hero ---------- */
export function hero({ eyebrow, title, em, lede, cta }) {
  return h("section", { class: "relative grid lg:grid-cols-[1.05fr_.95fr] gap-10 items-center mb-10 fade-in" },
    h("div", null,
      h("span", { class: "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 text-brand-700 text-[12.5px] font-bold mb-5" },
        icon("sparkles", { size: 14 }), eyebrow),
      h("h1", { class: "text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.12] text-slate-900" },
        title, " ", h("span", { class: "gradient-text" }, em)),
      h("p", { class: "mt-5 text-[15px] sm:text-base text-slate-600 leading-relaxed max-w-xl" }, lede),
      cta || null),
    heroMock());
}

function heroMock() {
  return h("div", { class: "relative hidden lg:block" },
    h("div", { class: "absolute -inset-6 bg-brand-100/50 blur-3xl rounded-full -z-10" }),
    h("div", { class: "glass rounded-[2rem] border border-white/60 shadow-soft p-5 animate-float" },
      h("div", { class: "flex items-center gap-3 mb-4" },
        h("div", { class: "w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-indigo-600 flex items-center justify-center text-white" },
          icon("hanger", { size: 18 })),
        h("div", null,
          h("div", { class: "font-extrabold tracking-tight text-slate-800 text-[15px]" }, "STYLE:ON 소싱 엔진"),
          h("div", { class: "text-[12px] text-slate-400 flex items-center gap-1.5" },
            h("span", { class: "w-1.5 h-1.5 rounded-full bg-emerald-500 ping-dot text-emerald-500" }), "실시간 재고 매칭 중…")),
        h("span", { class: "ml-auto text-slate-300" }, "···")),
      h("div", { class: "space-y-2.5" },
        mockRow("camel wrap coat", "ATELIER LUNE", "97", true),
        mockRow("silk slip dress", "AURORA ARCHIVE", "94", true),
        mockRow("tailored blazer", "NOIR DIVISION", "91", false)),
      h("div", { class: "mt-4 flex items-center justify-between text-[12px]" },
        h("span", { class: "text-slate-400" }, "협찬 가능 · 픽업 가능 우선 정렬"),
        h("span", { class: "px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 font-bold" }, "25 garments"))));
}
function mockRow(name, brand, score, hot) {
  return h("div", { class: "flex items-center gap-3 p-2.5 rounded-2xl bg-white/70 border border-slate-100" },
    h("div", { class: "w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center" }, icon("hanger", { size: 16 })),
    h("div", { class: "min-w-0 flex-1" },
      h("div", { class: "text-[13px] font-bold text-slate-700 truncate" }, name),
      h("div", { class: "text-[11px] text-slate-400" }, brand)),
    hot ? h("span", { class: "w-2 h-2 rounded-full bg-emerald-500" }) : h("span", { class: "w-2 h-2 rounded-full bg-slate-200" }),
    h("span", { class: "mono text-[12px] font-bold text-brand-600" }, score));
}

/* ---------- view ---------- */
function view() {
  const moodInput = h("textarea", { id: "src-mood", class: "control", rows: 2,
    placeholder: "무드·컨셉을 자유롭게 적어주세요 — 예: 미니멀 시티 오피스 트렌치", maxlength: 500 }, state.q);

  const catSel = sel("src-cat", CATEGORIES.map(c => ({ v: c.id, t: c.label })), state.category);
  const seaSel = sel("src-season", SEASONS.map(s => ({ v: s.id, t: s.label })), state.season);
  const sizeSel = sel("src-size", SIZES.map(s => ({ v: s, t: s || "전체 사이즈" })), state.size);

  const submit = h("button", { class: "btn btn-primary w-full sm:w-auto self-stretch sm:self-end", id: "src-go",
    onclick: () => { state.q = moodInput.value; runSearch(1); } },
    icon("search", { size: 16 }), "소싱하기");

  catSel.addEventListener("change", () => state.category = catSel.value);
  seaSel.addEventListener("change", () => state.season = seaSel.value);
  sizeSel.addEventListener("change", () => state.size = sizeSel.value);
  moodInput.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { state.q = moodInput.value; runSearch(1); }
  });

  const form = h("div", { class: "rounded-[2rem] border border-slate-100 bg-white shadow-soft p-6 sm:p-7" },
    h("div", { class: "flex flex-col sm:flex-row gap-4 sm:items-end" },
      h("div", { class: "field flex-1" },
        h("label", { for: "src-mood" }, "무드 · 컨셉"),
        moodInput),
      submit),
    h("div", { class: "flex flex-wrap gap-2 mt-3" },
      ...EXAMPLES.map(ex => chip(ex, { onClick: () => { moodInput.value = ex; state.q = ex; runSearch(1); } }))),
    h("div", { class: "grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-100" },
      field("카테고리", catSel),
      field("시즌", seaSel),
      field("사이즈", sizeSel)));

  return h("div", null,
    hero({
      eyebrow: "ON SOURCING · 01",
      title: "무드를", em: "재고로 연결합니다",
      lede: "컨셉 문장과 필터만 입력하면, 규칙 기반 랭킹이 협찬 가능한 실제 재고·쇼룸·픽업 여부까지 함께 제시합니다.",
    }),
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
  if (state.loading) { mount(box, h("div", { class: "mt-8" }, skeletonGrid(6))); return; }
  if (state.err) { mount(box, h("div", { class: "mt-8" }, errorState(state.err, () => runSearch(state.page)))); return; }

  const totalPages = Math.max(1, Math.ceil(state.total / PER_PAGE));
  const meta = resultsMeta(`총 ${state.total}개 결과`, `${state.page} / ${totalPages} 페이지`, totalPages);

  if (!state.results || !state.results.length) {
    mount(box, h("div", { class: "mt-8" }, meta,
      emptyState({ title: "조건에 맞는 결과가 없습니다", body: "무드 문장을 바꾸거나 필터를 완화해 보세요.", ico: "search" })));
    return;
  }

  const grid = h("div", { class: "garment-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mt-6" },
    ...state.results.map((r, i) => garmentCard(r, i)));
  mount(box, h("div", { class: "mt-8" }, meta, grid));

  function resultsMeta(count, pageLabel, tp) {
    return h("div", { class: "flex items-center justify-between gap-3 mt-2" },
      h("div", { class: "text-sm text-slate-500" }, h("b", { class: "text-slate-800" }, count), " · ", h("span", { class: "text-slate-400" }, pageLabel)),
      h("div", { class: "flex gap-2" },
        pageBtn("‹ 이전", state.page <= 1, () => runSearch(state.page - 1)),
        pageBtn("다음 ›", state.page >= tp, () => runSearch(state.page + 1))));
  }
}

export function garmentCardBase(g, { rank, score, badgeRight, children } = {}) {
  const sw = swatch(g);
  if (rank != null) {
    sw.append(h("span", { class: "absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-[12px] font-extrabold text-slate-700 shadow-card" },
      `#${rank}`, score != null ? h("span", { class: "text-brand-600" }, score) : null));
  }
  if (badgeRight) sw.append(badgeRight);
  return sw;
}

function garmentCard(result, idx) {
  const { garment: g, inventory = [], score, reasons = [] } = result;
  const rank = (state.page - 1) * PER_PAGE + idx + 1;

  const sw = garmentCardBase(g, { rank, score });
  const reservable = inventory.filter(i => i.reservable && i.stock_count > 0);

  const availBlock = inventory.length
    ? h("div", { class: "mt-3 pt-3 border-t border-slate-100" },
        h("div", { class: "flex flex-wrap gap-1.5" },
          ...dedupeSizes(inventory).map(i =>
            h("span", { class: "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-semibold " +
                (i.reservable && i.stock_count > 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400") },
              i.pickup_available ? h("span", { class: "w-1.5 h-1.5 rounded-full bg-brand-500" }) : null,
              h("span", null, i.size), h("span", { class: "text-slate-400" }, ` ×${i.stock_count}`)))),
        showroomLine(inventory))
    : h("div", { class: "mt-3 pt-3 border-t border-slate-100 text-[12.5px] text-slate-400" }, "연결된 재고 없음");

  return h("article", { class: "group rounded-3xl border border-slate-100 bg-white shadow-card hover:shadow-soft hover:-translate-y-1 transition-all duration-200 overflow-hidden flex flex-col" },
    h("div", { class: "relative overflow-hidden group-hover:[&_img]:scale-105 [&_img]:transition-transform [&_img]:duration-300" }, sw),
    h("div", { class: "p-5 flex-1 flex flex-col" },
      h("div", { class: "flex items-start justify-between gap-3" },
        h("div", { class: "min-w-0" },
          h("div", { class: "text-[11px] font-bold uppercase tracking-wide text-brand-600" }, g.brand),
          h("h3", { class: "font-extrabold tracking-tight text-slate-800 leading-snug" }, g.name)),
        h("div", { class: "mono text-[13px] font-bold text-slate-700 shrink-0" }, fmtKRW(g.price_krw))),
      h("div", { class: "flex flex-wrap gap-1.5 mt-3" }, ...(g.mood_tags || []).slice(0, 4).map(t => chip(t, { tag: true }))),
      reasons.length ? reasonsList("왜 추천하나요", reasons) : null,
      availBlock),
    h("div", { class: "px-5 pb-5 flex gap-2" },
      h("button", { class: "btn btn-soft btn-sm flex-1",
        onclick: () => openRequestModal({ garment: g, inventory: reservable.length ? reservable : inventory }) },
        icon("arrowRight", { size: 14 }), "협찬 요청"),
      h("a", { class: "btn btn-ghost btn-sm", href: `#/sponsor?garment=${encodeURIComponent(g.id)}&brand=${encodeURIComponent(g.brand)}` },
        "스폰서 확인")));
}

/* ---------- shared exports for ref.js ---------- */
export function reasonsList(title, reasons) {
  return h("div", { class: "mt-3 rounded-2xl bg-slate-50/80 p-3.5" },
    h("div", { class: "text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5" }, title),
    h("ul", { class: "space-y-1" },
      ...reasons.slice(0, 4).map(rs =>
        h("li", { class: "flex gap-2 text-[12.5px] text-slate-600 leading-snug" },
          h("span", { class: "text-brand-400 mt-0.5" }, "·"), rs))));
}

/* ---------- helpers ---------- */
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
  return h("div", { class: "flex items-center gap-1.5 mt-2 text-[12px] text-slate-500" }, icon("pin", { size: 13, cls: "text-brand-400" }),
    h("span", null, names[0], loc ? h("span", { class: "text-slate-400" }, ` · ${loc}`) : null,
      names.length > 1 ? h("span", { class: "text-slate-400" }, ` 외 ${names.length - 1}곳`) : null));
}
function sel(id, opts, value) {
  return h("select", { id }, ...opts.map(o => h("option", { value: o.v, selected: o.v === value }, o.t)));
}
function field(label, control) {
  return h("div", { class: "field" }, h("label", { for: control.id }, label), control);
}
export function pageBtn(label, disabled, onClick) {
  return h("button", { class: "btn btn-ghost btn-sm", disabled, onclick: onClick }, label);
}
