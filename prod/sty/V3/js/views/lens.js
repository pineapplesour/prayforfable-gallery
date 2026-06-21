// ON Lens — "what is this piece?" visual identify wired to the LIVE backend:
// POST /api/lens/identify -> { best_guess, similar_items[] }. Metadata-similarity
// seam today; image-embedding-ready contract.
import { h, icon, swatch, chip, mount, emptyState, errorState, fmtKRW } from "../ui.js";
import { CATEGORIES } from "../config.js";
import { api } from "../api.js";
import { openRequestModal } from "../requestModal.js";

// Real preset references that exercise the live matcher with strong signals.
const PRESETS = [
  { label: "베이지 트렌치", image_url: "/platform/web/assets/garments/trench-beige-001.jpg", hint_text: "beige trench coat outerwear", category_hint: "outer", color_hint: "beige" },
  { label: "블랙 터틀넥 니트", image_url: "/platform/web/assets/garments/turtleneck-black-001.jpg", hint_text: "black ribbed turtleneck knit", category_hint: "top", color_hint: "black" },
  { label: "라이트 데님", image_url: "/platform/web/assets/garments/jeans-light-001.jpg", hint_text: "light wash denim jeans", category_hint: "bottom", color_hint: "light blue" },
  { label: "크림 스니커즈", image_url: "/platform/web/assets/garments/sneaker-cream-court-001.jpg", hint_text: "cream court sneaker shoes", category_hint: "shoes", color_hint: "cream" },
];

let busy = false;

export default {
  async render(root) {
    mount(root, view());
    // run an initial identify so the screen is alive with real data
    applyPreset(PRESETS[0], { run: true });
    return () => { busy = false; };
  },
};

function view() {
  const urlInput = h("input", { type: "url", id: "ln-url", class: "control", placeholder: "https://…/item.jpg" });
  const idInput = h("input", { type: "text", id: "ln-id", class: "control", placeholder: "또는 이미지 ID — 예: trench-beige-001" });
  const hintInput = h("input", { type: "text", id: "ln-hint", class: "control", placeholder: "예: beige trench coat" });
  const catSel = h("select", { id: "ln-cat" },
    ...CATEGORIES.map(c => h("option", { value: c.id }, c.id ? c.label : "카테고리 힌트 없음")));
  const colorInput = h("input", { type: "text", id: "ln-color", class: "control", placeholder: "예: beige" });

  const form = h("div", { class: "panel panel-pad", style: { display: "flex", flexDirection: "column", gap: "16px" } },
    h("div", { class: "section-label" }, "이미지로 식별"),
    h("div", { class: "field" }, h("label", { for: "ln-url" }, "이미지 URL"), urlInput),
    h("div", { class: "field" }, h("label", { for: "ln-id" }, "이미지 ID ", h("span", { class: "muted" }, "(URL 대신)")), idInput),
    h("div", { class: "field" }, h("label", { for: "ln-hint" }, "텍스트 힌트 ", h("span", { class: "muted" }, "(선택)")), hintInput),
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { for: "ln-cat" }, "카테고리 힌트"), catSel),
      h("div", { class: "field" }, h("label", { for: "ln-color" }, "색상 힌트"), colorInput)),
    h("button", { class: "btn btn-primary btn-block", id: "ln-go", onclick: () => runIdentify() },
      icon("search", { size: 16 }), "식별하기"),
    h("div", { class: "field" },
      h("label", null, "예시 레퍼런스"),
      h("div", { class: "example-chips" },
        ...PRESETS.map(p => chip(p.label, { onClick: () => applyPreset(p, { run: true }) })))));

  return h("section", { class: "view" },
    h("header", { class: "view-head" },
      h("div", { class: "eyebrow" }, "ON LENS · 06"),
      h("h1", { class: "view-title" }, "이 아이템, ", h("em", null, "무엇"), "일까요"),
      h("p", { class: "view-lede" }, "레퍼런스 이미지·힌트를 입력하면 카탈로그에서 가장 유사한 브랜드·제품을 추정하고, 비슷한 후보들을 함께 보여줍니다.")),
    h("div", { class: "sponsor-layout" },
      form,
      h("div", { id: "ln-result" }, placeholder())));
}

function applyPreset(p, { run = false } = {}) {
  const url = document.getElementById("ln-url");
  const id = document.getElementById("ln-id");
  const hint = document.getElementById("ln-hint");
  const cat = document.getElementById("ln-cat");
  const color = document.getElementById("ln-color");
  if (!url) return;
  url.value = p.image_url || "";
  id.value = "";
  hint.value = p.hint_text || "";
  cat.value = p.category_hint || "";
  color.value = p.color_hint || "";
  if (run) runIdentify();
}

function placeholder() {
  return h("div", { class: "state" },
    icon("search", { size: 46, stroke: 1.2, cls: "state-ico" }),
    h("h3", null, "이미지를 입력해 식별하세요"),
    h("p", null, "이미지 URL 또는 ID와 힌트를 입력하고 ‘식별하기’를 누르면 결과가 여기에 표시됩니다."));
}

async function runIdentify() {
  if (busy) return;
  const url = (document.getElementById("ln-url").value || "").trim();
  const id = (document.getElementById("ln-id").value || "").trim();
  const hint = (document.getElementById("ln-hint").value || "").trim();
  const cat = document.getElementById("ln-cat").value;
  const color = (document.getElementById("ln-color").value || "").trim();

  if (!url && !id) {
    mount(document.getElementById("ln-result"),
      errorState({ message: "이미지 URL 또는 이미지 ID를 입력하세요.", status: 0 }, null));
    return;
  }

  const payload = { hint_text: hint, per_page: 8 };
  if (url) payload.image_url = url;
  if (id) payload.image_id = id;
  if (cat) payload.category_hint = cat;
  if (color) payload.color_hint = color;

  const box = document.getElementById("ln-result");
  const btn = document.getElementById("ln-go");
  busy = true;
  if (btn) { btn.disabled = true; btn.replaceChildren(h("span", { class: "spin" }), "식별 중…"); }
  mount(box, loadingResult());

  try {
    const res = await api.lensIdentify(payload);
    mount(box, resultCard(res));
  } catch (err) {
    mount(box, errorState(err, () => runIdentify()));
  } finally {
    busy = false;
    if (btn) { btn.disabled = false; btn.replaceChildren(icon("search", { size: 16 }), "식별하기"); }
  }
}

function loadingResult() {
  return h("div", { class: "panel panel-pad", style: { display: "flex", flexDirection: "column", gap: "14px" } },
    h("div", { class: "skel-line w40 shimmer", style: { height: "28px" } }),
    h("div", { class: "skel-line w90 shimmer", style: { height: "120px", marginTop: "8px" } }),
    h("div", { class: "skel-line w70 shimmer" }),
    h("div", { class: "skel-line w90 shimmer" }));
}

function resultCard(res) {
  const bg = res.best_guess || {};
  const items = res.similar_items || [];
  const matched = items.find(it => it.garment?.id === bg.garment_id)?.garment
    || items[0]?.garment || null;
  const confPct = Math.round((bg.confidence || 0) * 100);

  const hero = h("div", { class: "lens-hero" },
    h("div", { class: "lens-hero-img" }, matched ? swatch(matched, { square: true }) : null),
    h("div", { class: "lens-hero-body" },
      h("div", { class: "row", style: { gap: "8px", marginBottom: "8px" } },
        h("span", { class: "pill ok" }, h("span", { class: "pdot" }), "최적 추정"),
        h("span", { class: "pill neutral" }, h("span", { class: "pdot" }), `신뢰도 ${confPct}%`)),
      h("div", { class: "gcard-brand" }, bg.brand || "—"),
      h("h3", { class: "lens-hero-name" }, bg.product_name || "—"),
      h("div", { class: "row wrap", style: { gap: "8px", marginTop: "8px" } },
        bg.category ? chip(bg.category, { tag: true }) : null,
        bg.color ? chip(bg.color, { tag: true }) : null,
        matched ? h("span", { class: "gcard-price" }, fmtKRW(matched.price_krw)) : null),
      h("div", { class: "lens-conf" },
        h("div", { class: "lens-conf-bar" }, h("span", { style: { width: confPct + "%" } })),
        h("span", { class: "mono muted", style: { fontSize: "11px" } }, bg.source || "")),
      matched ? h("div", { class: "lens-actions" },
        h("button", { class: "btn btn-signal btn-sm", onclick: () => openRequestModal({ garment: matched }) },
          icon("arrowRight", { size: 14 }), "협찬 요청"),
        h("a", { class: "btn btn-ghost btn-sm", href: `#/sponsor?garment=${encodeURIComponent(matched.id)}&brand=${encodeURIComponent(matched.brand)}` },
          "스폰서 확인")) : null));

  const simHead = h("div", { class: "section-label", style: { marginTop: "24px" } },
    `유사 후보 ${items.length}건 · 전체 ${res.total}건 매칭`);

  const grid = items.length
    ? h("div", { class: "lens-sim-grid" }, ...items.map(simCard))
    : emptyState({ title: "유사 후보가 없습니다", ico: "search" });

  const seam = res.vision_seam ? h("p", { class: "seam-note" }, icon("info", { size: 13 }), res.vision_seam) : null;

  return h("div", { style: { display: "flex", flexDirection: "column" } },
    h("div", { class: "lens-id mono muted" }, "식별 ID · ", res.identification_id),
    hero, simHead, grid, seam);
}

function simCard(it) {
  const g = it.garment;
  return h("article", { class: "lens-sim" },
    h("div", { class: "lens-sim-img" }, swatch(g, { square: true })),
    h("div", { class: "lens-sim-body" },
      h("div", { class: "gcard-brand" }, g.brand),
      h("div", { class: "lens-sim-name" }, g.name),
      h("div", { class: "row wrap", style: { gap: "6px", margin: "6px 0" } },
        h("span", { class: "size-stock" }, h("span", { class: "sz" }, "score"), h("span", { class: "muted" }, ` ${it.score}`)),
        chip(g.color, { tag: true })),
      (it.reasons || []).length ? h("div", { class: "lens-sim-reason muted" }, it.reasons[0]) : null));
}
