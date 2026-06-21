// ON Trend — current ranking + 4-week forecast wired to the LIVE backend:
// GET /api/trend/brief -> ranked trend signals with growth + forecast_4w.
import { h, icon, mount, chip, skeletonGrid, emptyState, errorState } from "../ui.js";
import { api } from "../api.js";

let state = { loading: false, err: null, results: null, rows: 0, seam: "" };

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
      h("div", { class: "eyebrow" }, "ON TREND · 07"),
      h("h1", { class: "view-title" }, "지금 뜨는 ", h("em", null, "트렌드"), "와 4주 전망"),
      h("p", { class: "view-lede" }, "현재 트렌드 랭킹과 향후 4주 예측 점수를 한 화면에서 확인합니다. 점수와 성장률은 시그널 데이터로부터 계산됩니다.")),
    h("div", { class: "track-toolbar" },
      h("div", { class: "section-label", style: { margin: "0" } }, "트렌드 브리프"),
      h("button", { class: "btn btn-ghost btn-sm", onclick: load }, icon("refresh", { size: 14 }), "새로고침")),
    h("div", { id: "trend-body" }));
}

async function load() {
  const body = document.getElementById("trend-body");
  if (!body) return;
  state.loading = true; state.err = null;
  mount(body, h("div", { style: { marginTop: "6px" } }, skeletonGrid(4)));
  try {
    const res = await api.trendBrief({ per_page: 50 });
    state.results = res.results || [];
    state.rows = res.generated_from_rows || 0;
    state.seam = res.data_seam || "";
    state.loading = false;
    paint();
  } catch (err) {
    state.loading = false; state.err = err;
    mount(body, errorState(err, load));
  }
}

function paint() {
  const body = document.getElementById("trend-body");
  if (!body) return;
  if (!state.results.length) {
    mount(body, emptyState({ title: "트렌드 데이터가 없습니다", ico: "spark" }));
    return;
  }
  const meta = h("div", { class: "results-meta" },
    h("div", { class: "count" }, "총 ", h("b", null, String(state.results.length)), "개 트렌드 · ",
      h("span", { class: "muted" }, `시그널 ${state.rows}행 기반`)));
  const list = h("div", { class: "trend-list" }, ...state.results.map((t, i) => trendCard(t, i)));
  const seam = state.seam ? h("p", { class: "seam-note" }, icon("info", { size: 13 }), state.seam) : null;
  mount(body, h("div", null, meta, list, seam));
}

function trendCard(t, idx) {
  const forecast = t.forecast_4w || [];
  const series = [{ week: 0, projected_score: t.current_score }, ...forecast];
  const max = Math.max(1, ...series.map(p => p.projected_score));
  const up = t.growth_rate >= 0;
  const growthPct = (up ? "+" : "") + Math.round(t.growth_rate * 100) + "%";
  const last = forecast.length ? forecast[forecast.length - 1].projected_score : t.current_score;

  const bars = h("div", { class: "trend-chart" },
    ...series.map((p, i) => {
      const hPct = Math.max(6, Math.round((p.projected_score / max) * 100));
      const isNow = i === 0;
      return h("div", { class: "trend-bar-col" + (isNow ? " now" : "") },
        h("span", { class: "trend-bar-val mono" }, String(p.projected_score)),
        h("div", { class: "trend-bar-track" },
          h("span", { class: "trend-bar-fill" + (isNow ? " now" : ""), style: { height: hPct + "%" } })),
        h("span", { class: "trend-bar-x mono" }, isNow ? "현재" : `+${p.week}주`));
    }));

  return h("article", { class: "trend-card" },
    h("div", { class: "trend-rank mono" }, `#${idx + 1}`),
    h("div", { class: "trend-main" },
      h("div", { class: "trend-head" },
        h("div", null,
          h("h3", { class: "trend-label" }, t.label),
          h("div", { class: "row wrap", style: { gap: "8px", marginTop: "6px" } },
            chip(t.category, { tag: true }),
            h("span", { class: "mono muted", style: { fontSize: "11px" } }, t.trend_key))),
        h("div", { class: "trend-scores" },
          h("div", { class: "trend-score" }, h("span", { class: "ts-num mono" }, String(t.current_score)), h("span", { class: "ts-lbl" }, "현재 점수")),
          h("span", { class: `trend-growth ${up ? "up" : "down"}` },
            icon(up ? "arrowRight" : "arrowRight", { size: 13 }), growthPct))),
      bars,
      h("div", { class: "trend-foot muted" }, `4주 후 예측 점수 `, h("b", null, String(last)))));
}
