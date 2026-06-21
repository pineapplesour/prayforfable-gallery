// ON Trend — current ranking + 4-week forecast wired to the LIVE backend:
// GET /api/trend/brief.  Re:Connect 룩 — 다크 시네마틱 쇼케이스 트렌드 카드.
import { h, icon, mount, chip, skeletonGrid, emptyState, errorState } from "../ui.js";
import { api } from "../api.js";
import { viewHead, sectionLabel } from "./sponsor.js";

let state = { loading: false, err: null, results: null, rows: 0, seam: "" };

export default {
  async render(root) { mount(root, shell()); load(); return () => {}; },
};

function shell() {
  return h("div", null,
    viewHead("ON TREND · 07", "지금 뜨는", "트렌드와 4주 전망",
      "현재 트렌드 랭킹과 향후 4주 예측 점수를 한 화면에서 확인합니다. 점수와 성장률은 시그널 데이터로부터 계산됩니다."),
    h("div", { class: "flex items-center justify-between gap-3 mb-5" },
      sectionLabel("트렌드 브리프"),
      h("button", { class: "btn btn-ghost btn-sm", onclick: load }, icon("refresh", { size: 14 }), "새로고침")),
    h("div", { id: "trend-body" }));
}

async function load() {
  const body = document.getElementById("trend-body");
  if (!body) return;
  state.loading = true; state.err = null;
  mount(body, h("div", { class: "mt-2" }, skeletonGrid(4)));
  try {
    const res = await api.trendBrief({ per_page: 50 });
    state.results = res.results || [];
    state.rows = res.generated_from_rows || 0;
    state.seam = res.data_seam || "";
    state.loading = false;
    paint();
  } catch (err) { state.loading = false; state.err = err; mount(body, errorState(err, load)); }
}

function paint() {
  const body = document.getElementById("trend-body");
  if (!body) return;
  if (!state.results.length) { mount(body, emptyState({ title: "트렌드 데이터가 없습니다", ico: "spark" })); return; }
  const meta = h("div", { class: "text-sm text-slate-500 mb-4" },
    "총 ", h("b", { class: "text-slate-800" }, String(state.results.length)), "개 트렌드 · ",
    h("span", { class: "text-slate-400" }, `시그널 ${state.rows}행 기반`));
  const list = h("div", { class: "grid md:grid-cols-2 gap-5" }, ...state.results.map((t, i) => trendCard(t, i)));
  const seam = state.seam ? h("p", { class: "flex items-center gap-2 mt-5 text-[12.5px] text-slate-400" }, icon("info", { size: 13 }), state.seam) : null;
  mount(body, h("div", null, meta, list, seam));
}

function trendCard(t, idx) {
  const forecast = t.forecast_4w || [];
  const series = [{ week: 0, projected_score: t.current_score }, ...forecast];
  const max = Math.max(1, ...series.map(p => p.projected_score));
  const up = t.growth_rate >= 0;
  const growthPct = (up ? "+" : "") + Math.round(t.growth_rate * 100) + "%";
  const last = forecast.length ? forecast[forecast.length - 1].projected_score : t.current_score;

  const bars = h("div", { class: "flex items-end justify-between gap-2 h-28 mt-5" },
    ...series.map((p, i) => {
      const hPct = Math.max(8, Math.round((p.projected_score / max) * 100));
      const isNow = i === 0;
      return h("div", { class: "flex-1 flex flex-col items-center gap-1.5 h-full justify-end" },
        h("span", { class: "mono text-[10.5px] font-bold " + (isNow ? "text-brand-300" : "text-slate-400") }, String(p.projected_score)),
        h("div", { class: "w-full rounded-t-lg flex items-end h-full" },
          h("span", { class: "trend-bar-fill w-full rounded-t-lg " + (isNow ? "bg-gradient-to-t from-brand-500 to-brand-300" : "bg-white/15"), style: { height: hPct + "%" } })),
        h("span", { class: "mono text-[10px] " + (isNow ? "text-brand-300 font-bold" : "text-slate-500") }, isNow ? "현재" : `+${p.week}주`));
    }));

  return h("article", { class: "rounded-[2rem] overflow-hidden bg-slate-900 shadow-soft relative p-6 fade-in" },
    h("div", { class: "absolute -top-16 -right-12 w-48 h-48 bg-brand-600/25 blur-3xl rounded-full pointer-events-none" }),
    h("div", { class: "relative" },
      h("div", { class: "flex items-start justify-between gap-3" },
        h("div", { class: "min-w-0" },
          h("div", { class: "flex items-center gap-2 mb-2" },
            h("span", { class: "mono text-[12px] font-bold text-brand-300 bg-white/10 rounded-lg px-2 py-0.5" }, `#${idx + 1}`),
            h("span", { class: "px-2.5 py-1 rounded-full bg-white/10 text-slate-300 text-[11px] font-semibold" }, t.category)),
          h("h3", { class: "text-lg font-extrabold tracking-tight text-white truncate" }, t.label),
          h("div", { class: "mono text-[11px] text-slate-500 mt-0.5" }, t.trend_key)),
        h("div", { class: "text-right shrink-0" },
          h("div", { class: "mono text-3xl font-extrabold text-white leading-none" }, String(t.current_score)),
          h("div", { class: "text-[11px] text-slate-400 mt-1" }, "현재 점수"),
          h("span", { class: "inline-flex items-center gap-1 mt-1.5 px-2 py-1 rounded-full text-[12px] font-bold " + (up ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300") },
            icon("trendUp", { size: 13, cls: up ? "" : "rotate-180" }), growthPct))),
      bars,
      h("div", { class: "mt-4 pt-4 border-t border-white/10 text-[13px] text-slate-400" }, "4주 후 예측 점수 ", h("b", { class: "text-white" }, String(last)))));
}
