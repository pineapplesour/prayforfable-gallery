// Tiny DOM toolkit + shared, XSS-safe components for STYLE:ON.
// Re:Connect design language: violet accents, rounded glass cards, Lucide icons.

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

/* re-scan for any [data-lucide] placeholders (used by markup that opts in) */
export function lucide() { try { window.lucide?.createIcons(); } catch { /* ignore */ } }

/* ---------- icons (Lucide stroke paths, inline SVG) ----------
   Keyed by the names views already use; values are Lucide icon inner markup. */
const I = {
  // search / interaction
  search:     '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  pin:        '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  lock:       '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  check:      '<path d="M20 6 9 17l-5-5"/>',
  checkCircle:'<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>',
  x:          '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  xCircle:    '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  warn:       '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info:       '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  alert:      '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  phone:      '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail:       '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  refresh:    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  empty:      '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  spark:      '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  sparkles:   '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  layers:     '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
  wand:       '<path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.36a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/>',
  building:   '<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
  menu:       '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>',
  // category glyphs (Lucide-ish)
  cat_outer:  '<path d="M8 2 3 6l2 4 1-.5V22h12V9.5l1 .5 2-4-5-4-3 2-3-2Z"/>',
  cat_top:    '<path d="M8 2 3 6l2 4 1-.5V22h12V9.5l1 .5 2-4-5-4-3 2-3-2Z"/><path d="M9 9h6"/>',
  cat_bottom: '<path d="M6 2h12l1 20h-6l-1-9-1 9H5L6 2Z"/>',
  cat_full:   '<path d="M9 2 7 6v4l-1 3 2 .5V22h8v-8.5l2-.5-1-3V6l-2-4-3 2-3-2Z"/>',
  cat_shoes:  '<path d="M2 16h13l5-1c1 0 2-1 2-2s-1-2-3-3l-5-3-1 3-5-1-1 3H3l-1 4Z"/>',
  cat_bag:    '<path d="M6 8h12l1 13H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  cat_jewelry:'<path d="m12 2 4 6-4 14L8 8l4-6Z"/><path d="M5 8h14"/>',
  cat_accessory:'<circle cx="8" cy="12" r="5"/><circle cx="16" cy="12" r="5"/>',
};
export function icon(name, { size = 18, stroke = 2, cls = "" } = {}) {
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

/* ---------- garment image (real photo, quiet neutral placeholder) ---------- */
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
    h("div", { class: "sf-glyph" }, catIcon(garment.category, { size: 56, stroke: 1.2 })),
    h("span", { class: "sf-brand" }, garment.brand || ""),
  );
  wrap.append(fallback);

  if (attemptImage) {
    const candidates = imageCandidates(garment);
    if (candidates.length) {
      const img = h("img", { alt: garment.name || "", loading: "lazy", decoding: "async" });
      let i = 0;
      const tryNext = () => {
        if (i >= candidates.length) { img.remove(); return; }
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
    icon(ico, { size: 42, stroke: 1.6, cls: "state-ico" }),
    h("h3", null, title),
    body && h("p", null, body),
    action || null);
}

export function errorState(err, onRetry) {
  const status = err?.status;
  const isValidation = Array.isArray(err?.detail);
  return h("div", { class: "state error" },
    icon("alert", { size: 42, stroke: 1.7, cls: "state-ico" }),
    h("h3", null, status === 0 ? "백엔드에 연결할 수 없습니다" : (isValidation ? "입력값을 확인하세요" : "문제가 발생했습니다")),
    h("p", null, err?.message || "알 수 없는 오류"),
    status ? h("p", null, h("code", null, `HTTP ${status}`)) : null,
    onRetry ? h("button", { class: "btn btn-ghost", onclick: onRetry }, icon("refresh", { size: 15 }), "다시 시도") : null);
}

export function fmtKRW(n) {
  if (n == null) return "—";
  return "₩" + Number(n).toLocaleString("ko-KR");
}
