// Tiny DOM toolkit + shared, XSS-safe components for STYLE:ON.
// Re:Connect 디자인 언어(보라 brand on 슬레이트, 둥근 글래스 카드, soft 그림자)로
// 리스킨. export 시그니처는 view 호환을 위해 유지.

/* ---------- hyperscript ---------- */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k === "html") el.innerHTML = v;            // trusted strings only (our SVG)
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in el && k !== "list") { try { el[k] = v; } catch { el.setAttribute(k, v); } }
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === true) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export const frag = (...children) => { const f = document.createDocumentFragment(); append(f, children); return f; };
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const mount = (el, ...children) => { clear(el); append(el, children); return el; };

/* ---------- icons (inline SVG, Lucide-style stroke geometry) ---------- */
const I = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5L16 9"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
  warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowUpRight: '<path d="M7 17 17 7M7 7h10v10"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/>',
  empty: '<path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-7l-2-2H5a2 2 0 0 0-2 2Z"/>',
  spark: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
  wand: '<path d="m15 4 5 5L9 20l-5 1 1-5L15 4Z"/><path d="m14 5 5 5M18 3l.6 1.4L20 5l-1.4.6L18 7l-.6-1.4L16 5l1.4-.6L18 3Z"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M10 21v-3h4v3"/>',
  hanger: '<path d="M12 3a2 2 0 0 0-1 3.7c.6.4 1 1 1 1.8V9"/><path d="M12 9 3.5 14.5A1.5 1.5 0 0 0 4.3 17h15.4a1.5 1.5 0 0 0 .8-2.5L12 9Z"/>',
  sparkles: '<path d="M9.9 4.2 11 8l3.8 1.1L11 10.3 9.9 14 8.8 10.3 5 9.1 8.8 8 9.9 4.2Z"/><path d="M18 4v3M19.5 5.5h-3M18 15v3M19.5 16.5h-3"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  trendUp: '<path d="m3 17 6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1L4 2Z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  // category glyphs
  cat_outer: '<path d="M8 3 4 7v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7l-4-4-4 3-4-3Z"/><path d="M12 6v15"/>',
  cat_top: '<path d="M8 3 3 6l2 4 2-1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9l2 1 2-4-5-3-4 3-4-3Z"/>',
  cat_bottom: '<path d="M6 3h12l1 18h-5l-2-9-2 9H5L6 3Z"/>',
  cat_full: '<path d="M9 3 7 6v3l-1 3 2 1v7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-7l2-1-1-3V6l-2-3-3 2-3-2Z"/>',
  cat_shoes: '<path d="M2 17h13l5-1c1 0 2-1 2-2 0-1-1-2-3-3l-5-3-1 3-5-1-1 3H3l-1 4Z"/>',
  cat_bag: '<path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  cat_jewelry: '<path d="m12 3 4 5-4 13L8 8l4-5Z"/><path d="M5 8h14"/>',
  cat_accessory: '<circle cx="8" cy="12" r="5"/><circle cx="16" cy="12" r="5"/>',
};
export function icon(name, { size = 18, stroke = 1.8, cls = "" } = {}) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size); svg.setAttribute("height", size);
  svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", stroke);
  svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
  if (cls) svg.setAttribute("class", cls);
  svg.innerHTML = I[name] || I.empty;
  return svg;
}
export const catIcon = (category, opts) => icon(`cat_${category}`, opts);

/* ---------- garment image (real photo, quiet neutral placeholder) ----------
   Real generated editorial product images live under assets/garments/<id>.jpg
   served same-origin. Try local asset, then backend image_url, then a calm
   violet-tinted placeholder — never a saturated block. */
const LOCAL_GARMENT_BASE = "assets/garments/";

function imageCandidates(garment) {
  const urls = [];
  if (garment.id) urls.push(LOCAL_GARMENT_BASE + encodeURIComponent(garment.id) + ".jpg");
  if (garment.image_url) urls.push(garment.image_url);
  return urls;
}

// garment: { id, color, category, brand, name, image_url }
export function swatch(garment, { square = false, attemptImage = true } = {}) {
  const wrap = h("div", { class: "swatch" + (square ? " sq" : "") });
  const fallback = h("div", { class: "swatch-fallback" },
    h("span", { class: "sf-cat" }, garment.category || "item"),
    h("div", { class: "sf-glyph" }, catIcon(garment.category, { size: 56, stroke: 1.1 })),
    h("span", { class: "sf-brand" }, garment.brand || ""),
  );
  wrap.append(fallback);

  if (attemptImage) {
    const candidates = imageCandidates(garment);
    if (candidates.length) {
      const img = h("img", { alt: garment.name || "", loading: "lazy", decoding: "async" });
      let i = 0;
      const tryNext = () => {
        if (i >= candidates.length) { img.remove(); return; }   // reveal neutral placeholder
        img.src = candidates[i++];
      };
      img.addEventListener("error", tryNext);
      img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
      tryNext();
      wrap.append(img);
    }
  }
  return wrap;
}

/* ---------- small components ---------- */
export const chip = (text, { tag = false, onClick } = {}) =>
  h("span", { class: "chip" + (tag ? " tag" : "") + (onClick ? " is-clickable" : ""),
    ...(onClick ? { onclick: onClick, role: "button", tabindex: 0,
      onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e); } } } : {}) }, text);

const AVAIL = {
  available:   { cls: "ok",   label: "협찬 가능",   ico: "checkCircle" },
  conditional: { cls: "warn", label: "조건부 가능", ico: "alert" },
  unavailable: { cls: "bad",  label: "협찬 불가",   ico: "xCircle" },
};
export function availPill(state) {
  const m = AVAIL[state] || { cls: "neutral", label: state, ico: "info" };
  return h("span", { class: `pill ${m.cls}` }, h("span", { class: "pdot" }), m.label);
}
export const availMeta = (state) => AVAIL[state] || { cls: "neutral", label: state, ico: "info" };

const STATUS = {
  candidate: { ko: "후보",   hue: "#64748b" },
  requested: { ko: "요청됨", hue: "#7c3aed" },
  reserved:  { ko: "예약됨", hue: "#4338ca" },
  picked_up: { ko: "픽업됨", hue: "#0891b2" },
  returned:  { ko: "반납됨", hue: "#15803d" },
  rejected:  { ko: "거절됨", hue: "#e11d48" },
};
export const statusMeta = (s) => STATUS[s] || { ko: s, hue: "#94a3b8" };

export function statusPill(s) {
  const m = statusMeta(s);
  return h("span", { class: "pill", style: { color: m.hue, background: "color-mix(in srgb," + m.hue + " 14%, white)" } },
    h("span", { class: "pdot" }), m.ko);
}

// D-day: days until return. negative => overdue. status returned/rejected => closed.
export function ddayBadge(d_day, status) {
  if (status === "returned") return h("span", { class: "dday done" }, "반납 완료");
  if (status === "rejected") return h("span", { class: "dday calm" }, "종료");
  if (d_day == null) return h("span", { class: "dday calm" }, "일정 미정");
  let cls = "calm", text;
  if (d_day < 0) { cls = "over"; text = `D+${Math.abs(d_day)} 지연`; }
  else if (d_day === 0) { cls = "now"; text = "D-DAY"; }
  else if (d_day <= 2) { cls = "now"; text = `D-${d_day}`; }
  else if (d_day <= 5) { cls = "soon"; text = `D-${d_day}`; }
  else { cls = "calm"; text = `D-${d_day}`; }
  return h("span", { class: `dday ${cls}` }, text);
}

/* ---------- states ---------- */
export function skeletonGrid(n = 6) {
  const cards = Array.from({ length: n }, () =>
    h("div", { class: "skel" },
      h("div", { class: "skel-img shimmer" }),
      h("div", { class: "skel-body" },
        h("div", { class: "skel-line w40 shimmer" }),
        h("div", { class: "skel-line w90 shimmer" }),
        h("div", { class: "skel-line w70 shimmer" }),
      )));
  return h("div", { class: "skeleton-grid" }, ...cards);
}

// neutral / empty / error states — rounded glass card, violet icon chip
export function emptyState({ title = "결과가 없습니다", body = "", ico = "empty", action } = {}) {
  return h("div", { class: "rounded-3xl border border-slate-100 bg-white/70 shadow-card px-6 py-14 text-center flex flex-col items-center gap-3" },
    h("div", { class: "w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center" },
      icon(ico, { size: 30, stroke: 1.6 })),
    h("h3", { class: "text-lg font-extrabold tracking-tight text-slate-800" }, title),
    body && h("p", { class: "text-sm text-slate-500 max-w-sm leading-relaxed" }, body),
    action || null);
}

export function errorState(err, onRetry) {
  const status = err?.status;
  const isValidation = Array.isArray(err?.detail);
  return h("div", { class: "rounded-3xl border border-rose-100 bg-rose-50/50 shadow-card px-6 py-12 text-center flex flex-col items-center gap-3" },
    h("div", { class: "w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center" },
      icon("alert", { size: 30, stroke: 1.6 })),
    h("h3", { class: "text-lg font-extrabold tracking-tight text-slate-800" },
      status === 0 ? "백엔드에 연결할 수 없습니다" : (isValidation ? "입력값을 확인하세요" : "문제가 발생했습니다")),
    h("p", { class: "text-sm text-slate-500 max-w-md leading-relaxed" }, err?.message || "알 수 없는 오류"),
    status ? h("p", { class: "text-xs" }, h("code", { class: "mono px-2 py-1 rounded-lg bg-white text-slate-500 border border-slate-200" }, `HTTP ${status}`)) : null,
    onRetry ? h("button", { class: "btn btn-ghost btn-sm mt-1", onclick: onRetry }, icon("refresh", { size: 15 }), "다시 시도") : null);
}

export function fmtKRW(n) {
  if (n == null) return "—";
  return "₩" + Number(n).toLocaleString("ko-KR");
}
