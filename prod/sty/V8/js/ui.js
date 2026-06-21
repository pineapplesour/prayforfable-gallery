// Tiny DOM toolkit + shared, XSS-safe components for STYLE:ON.

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

/* ---------- icons (inline SVG) ---------- */
const I = {
  search: '<path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5L16 9"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
  warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v4h-4"/>',
  empty: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
  wand: '<path d="m15 4 5 5M3 21l9-9M14 5l5 5M19 3l2 2M5 19l-2 2"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M10 21v-3h4v3"/>',
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
export function icon(name, { size = 18, stroke = 1.6, cls = "" } = {}) {
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
   Real, generated editorial product images live under web/assets/garments/<id>.jpg
   and are served same-origin by the dev server. We try the local asset first,
   then any backend image_url, then degrade to a calm stone placeholder — never a
   saturated color block. */
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
    h("div", { class: "sf-glyph" }, catIcon(garment.category, { size: 64, stroke: 1.1 })),
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
  candidate: { ko: "후보",   hue: "var(--st-candidate)" },
  requested: { ko: "요청됨", hue: "var(--st-requested)" },
  reserved:  { ko: "예약됨", hue: "var(--st-reserved)" },
  picked_up: { ko: "픽업됨", hue: "var(--st-picked)" },
  returned:  { ko: "반납됨", hue: "var(--st-returned)" },
  rejected:  { ko: "거절됨", hue: "var(--st-rejected)" },
};
export const statusMeta = (s) => STATUS[s] || { ko: s, hue: "var(--ink-3)" };

export function statusPill(s) {
  const m = statusMeta(s);
  return h("span", { class: "pill neutral", style: { color: m.hue, background: "color-mix(in srgb," + m.hue + " 12%, transparent)" } },
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

export function emptyState({ title = "결과가 없습니다", body = "", ico = "empty", action } = {}) {
  return h("div", { class: "state" },
    icon(ico, { size: 46, stroke: 1.2, cls: "state-ico" }),
    h("h3", null, title),
    body && h("p", null, body),
    action || null);
}

export function errorState(err, onRetry) {
  const status = err?.status;
  const isValidation = Array.isArray(err?.detail);
  return h("div", { class: "state error" },
    icon("alert", { size: 46, stroke: 1.3, cls: "state-ico" }),
    h("h3", null, status === 0 ? "백엔드에 연결할 수 없습니다" : (isValidation ? "입력값을 확인하세요" : "문제가 발생했습니다")),
    h("p", null, err?.message || "알 수 없는 오류"),
    status ? h("p", null, h("code", null, `HTTP ${status}`)) : null,
    onRetry ? h("button", { class: "btn btn-ghost", onclick: onRetry }, icon("refresh", { size: 15 }), "다시 시도") : null);
}

export function fmtKRW(n) {
  if (n == null) return "—";
  return "₩" + Number(n).toLocaleString("ko-KR");
}
