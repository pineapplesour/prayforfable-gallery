// ON Sponsor — celebrity + brand (+garment) -> availability + manager channel.
// PII in the manager channel is role-gated; switching X-Role re-runs the check. (Re:Connect 룩)
import { h, icon, mount, swatch, chip, availMeta, errorState, fmtKRW } from "../ui.js";
import { CELEBRITIES, BRANDS } from "../config.js";
import { api, ApiError } from "../api.js";
import { getRole, roleMeta } from "../store.js";
import { loadGarments, garmentById, brandName, celebName, celebKo, brandIdByName } from "../catalog.js";
import { openRequestModal } from "../requestModal.js";

let last = null;
let detach = null;
let pendingGarment = null;

export default {
  async render(root, params) {
    mount(root, view(params));
    loadGarments().then(populateGarments).catch(showGarmentLoadError);
    if (params.brand) {
      const bid = brandIdByName(params.brand);
      if (bid) document.getElementById("sp-brand").value = bid;
    }
    if (params.garment) { pendingGarment = params.garment; tryApplyGarment(); }
    const handler = () => { if (last) runCheck(true); refreshRoleNote(); };
    document.addEventListener("role:applied", handler);
    detach = () => document.removeEventListener("role:applied", handler);
    return () => { detach?.(); detach = null; last = null; pendingGarment = null; };
  },
};

function tryApplyGarment() {
  const selEl = document.getElementById("sp-garment");
  if (selEl && pendingGarment && [...selEl.options].some(o => o.value === pendingGarment)) {
    selEl.value = pendingGarment;
    const g = garmentById(pendingGarment);
    if (g) document.getElementById("sp-brand").value = brandIdByName(g.brand) || document.getElementById("sp-brand").value;
    pendingGarment = null;
  }
}
function populateGarments(garments) {
  const selEl = document.getElementById("sp-garment");
  if (!selEl) return;
  document.getElementById("sp-garment-error")?.remove();
  selEl.replaceChildren(
    h("option", { value: "" }, "가먼트 없음 (브랜드 전체)"),
    ...garments.map(g => h("option", { value: g.id }, `${g.name} — ${g.brand}`)));
  tryApplyGarment();
}
function showGarmentLoadError(err) {
  const selEl = document.getElementById("sp-garment");
  if (selEl) selEl.replaceChildren(h("option", { value: "" }, "가먼트 없음 (브랜드 전체)"));
  const field = selEl?.closest(".field");
  if (!field) return;
  document.getElementById("sp-garment-error")?.remove();
  const message = err instanceof ApiError ? err.message : "가먼트 카탈로그를 불러오지 못했습니다.";
  field.append(redactBanner("warn", [message,
    h("button", { class: "btn btn-ghost btn-sm ml-2", onclick: retryLoadGarments }, icon("refresh", { size: 14 }), "다시 시도")], "sp-garment-error"));
}
function retryLoadGarments() {
  const selEl = document.getElementById("sp-garment");
  if (selEl) selEl.replaceChildren(h("option", { value: "" }, "카탈로그 불러오는 중…"));
  document.getElementById("sp-garment-error")?.remove();
  loadGarments().then(populateGarments).catch(showGarmentLoadError);
}

function view() {
  const celebSel = h("select", { id: "sp-celeb" }, ...CELEBRITIES.map(c => h("option", { value: c.id }, `${c.name} (${c.ko})`)));
  const brandSel = h("select", { id: "sp-brand" }, ...BRANDS.map(b => h("option", { value: b.id }, b.name)));
  const garmentSel = h("select", { id: "sp-garment" }, h("option", { value: "" }, "카탈로그 불러오는 중…"));

  const form = h("div", { class: "rounded-[2rem] border border-slate-100 bg-white shadow-soft p-6 flex flex-col gap-4" },
    sectionLabel("협찬 가용성 조회"),
    h("div", { class: "field" }, h("label", { for: "sp-celeb" }, "셀러브리티"), celebSel),
    h("div", { class: "field" }, h("label", { for: "sp-brand" }, "브랜드"), brandSel),
    h("div", { class: "field" }, h("label", { for: "sp-garment" }, "가먼트 ", h("span", { class: "text-slate-400" }, "(선택)")), garmentSel),
    h("button", { class: "btn btn-primary btn-block", id: "sp-go", onclick: () => runCheck(false) },
      icon("sparkles", { size: 16 }), "가용성 확인"),
    roleNote());

  return h("div", null,
    viewHead("ON SPONSOR · 02", "협찬", "가능 여부를 즉시 확인",
      "셀러브리티·브랜드(·가먼트) 조합의 협찬 가능 여부와 담당 매니저 연락 채널을 확인합니다. 연락처 PII는 역할(X-Role)에 따라 보호됩니다."),
    h("div", { class: "grid lg:grid-cols-[360px_1fr] gap-6 items-start" },
      form,
      h("div", { id: "sp-result" }, placeholder())));
}

function roleNote() {
  const m = roleMeta(getRole());
  const gated = getRole() === "stylist";
  return redactBanner(gated ? "lock" : "info",
    [h("span", null, "현재 역할 ", h("b", null, m.label), " · ", m.note,
      gated ? " — 우측 상단에서 역할을 바꿔 PII 노출 차이를 확인하세요." : "")], "sp-rolenote");
}
function refreshRoleNote() {
  const note = document.getElementById("sp-rolenote");
  if (note) note.replaceWith(roleNote());
}

function placeholder() {
  return h("div", { class: "rounded-[2rem] border border-slate-100 bg-white/70 shadow-card p-10 text-center flex flex-col items-center gap-3 min-h-[300px] justify-center" },
    h("div", { class: "w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center" }, icon("sparkles", { size: 30 })),
    h("h3", { class: "text-lg font-extrabold tracking-tight text-slate-800" }, "조합을 선택해 조회하세요"),
    h("p", { class: "text-sm text-slate-500 max-w-sm" }, "셀러브리티와 브랜드를 고르고 ‘가용성 확인’을 누르면 결과가 여기에 표시됩니다."));
}

async function runCheck(isRerun) {
  const celeb = document.getElementById("sp-celeb").value;
  const brand = document.getElementById("sp-brand").value;
  const garment = document.getElementById("sp-garment").value;
  last = { celebrity_id: celeb, brand_id: brand };
  if (garment) last.garment_id = garment;

  const box = document.getElementById("sp-result");
  const btn = document.getElementById("sp-go");
  if (!isRerun && btn) { btn.disabled = true; btn.replaceChildren(h("span", { class: "spin on-dark" }), "확인 중…"); }
  mount(box, loadingResult());

  try {
    const res = await api.sponsorCheck(last);
    mount(box, resultCard(res));
  } catch (err) {
    mount(box, errorState(err, () => runCheck(false)));
  } finally {
    if (btn) { btn.disabled = false; btn.replaceChildren(icon("sparkles", { size: 16 }), "가용성 확인"); }
    refreshRoleNote();
  }
}

function loadingResult() {
  return h("div", { class: "rounded-[2rem] border border-slate-100 bg-white shadow-card p-6 flex flex-col gap-4" },
    h("div", { class: "skel-line w40 shimmer", style: { height: "28px" } }),
    h("div", { class: "skel-line w90 shimmer" }),
    h("div", { class: "skel-line w70 shimmer" }),
    h("div", { class: "skel-line w90 shimmer", style: { height: "60px", marginTop: "8px" } }));
}

const VERDICT_TONE = {
  available:   "from-emerald-500 to-teal-500",
  conditional: "from-amber-500 to-orange-500",
  unavailable: "from-rose-500 to-pink-500",
};
function resultCard(res) {
  const meta = availMeta(res.availability);
  const g = res.garment_id ? garmentById(res.garment_id) : null;
  const tone = VERDICT_TONE[res.availability] || "from-slate-500 to-slate-600";

  const verdict = h("div", { class: `rounded-[2rem] p-7 text-white shadow-soft bg-gradient-to-br ${tone}` },
    h("div", { class: "flex items-center gap-3" },
      h("div", { class: "w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center" }, icon(meta.ico, { size: 26, stroke: 2 })),
      h("div", { class: "text-2xl font-extrabold tracking-tight" }, meta.label)),
    h("p", { class: "mt-3 text-white/90 leading-relaxed text-[14px]" }, res.reason),
    h("div", { class: "flex flex-wrap gap-2 mt-4" },
      tagWhite(celebName(res.celebrity_id) + (celebKo(res.celebrity_id) ? ` · ${celebKo(res.celebrity_id)}` : "")),
      tagWhite(brandName(res.brand_id)),
      tagWhite(res.garment_id ? (g ? g.name : res.garment_id) : "브랜드 전체 기준")));

  const channel = channelCard(res.manager_inquiry_channel);

  const actions = h("div", { class: "flex flex-wrap gap-2.5 mt-5" },
    h("button", { class: "btn btn-signal",
      disabled: res.availability === "unavailable",
      title: res.availability === "unavailable" ? "협찬 불가 조합입니다" : "",
      onclick: () => openRequestModal({ garment: g, brandId: res.brand_id, brandName: brandName(res.brand_id), celebrityId: res.celebrity_id }) },
      icon("arrowRight", { size: 16 }), "이 조합으로 협찬 요청"),
    h("a", { class: "btn btn-ghost", href: "#/track" }, "ON Track 보기"));

  return h("div", { class: "flex flex-col gap-4 fade-in" }, verdict,
    h("div", { class: "rounded-[2rem] border border-slate-100 bg-white shadow-card p-6" },
      sectionLabel("담당 매니저 연락 채널"), channel, actions));
}

function tagWhite(text) {
  return h("span", { class: "inline-flex items-center px-3 py-1.5 rounded-full bg-white/20 text-white text-[12.5px] font-semibold" }, text);
}

function channelCard(ch) {
  if (!ch) return h("div", { class: "text-sm text-slate-400 mt-3" }, "연락 채널 정보 없음");
  const cm = ch.contact_manager || {};
  const refLabel = ch.ref_type === "brand" ? "브랜드 직접" : "쇼룸/에이전시";

  const head = h("div", { class: "flex items-center justify-between gap-3 mt-3" },
    h("div", null,
      h("div", { class: "font-extrabold tracking-tight text-slate-800" }, cm.name || "—"),
      h("div", { class: "text-[12.5px] text-slate-500" }, cm.role || "")),
    h("span", { class: "pill neutral" }, h("span", { class: "pdot" }), refLabel));

  let rows;
  if (cm.redacted) {
    rows = redactBanner("lock", [h("span", null, h("b", null, "연락처 PII 비공개"),
      " — 현재 역할(", roleMeta(getRole()).label, ")에서는 전화·이메일이 보호됩니다. ",
      h("b", null, "관리자"), " 또는 ", h("b", null, "쇼룸 파트너"), " 역할에서 열람 가능합니다.")]);
  } else {
    rows = h("div", { class: "flex flex-col gap-2 mt-3" },
      cm.phone ? contactRow("전화", "phone", h("a", { class: "text-brand-700 font-medium", href: `tel:${cm.phone}` }, cm.phone)) : null,
      cm.email ? contactRow("이메일", "mail", h("a", { class: "text-brand-700 font-medium", href: `mailto:${cm.email}` }, cm.email)) : null);
  }

  const showroom = ch.showroom
    ? h("div", { class: "flex flex-col gap-2 mt-3 pt-3 border-t border-slate-100" },
        contactRow("쇼룸", "building", h("span", null, ch.showroom.name)),
        ch.showroom.location ? contactRow("위치", "pin", h("span", null, ch.showroom.location)) : null,
        ch.showroom.notes ? h("div", { class: "text-[12px] text-slate-400 pl-[60px]" }, ch.showroom.notes) : null)
    : null;

  return h("div", { class: "mt-1" },
    head,
    h("div", { class: "flex items-center justify-between gap-3 mt-3 text-[13px]" },
      h("span", { class: "text-slate-400" }, "브랜드"), h("span", { class: "font-semibold text-slate-700" }, ch.brand_name || "—")),
    rows, showroom);
}

function contactRow(label, ico, value) {
  return h("div", { class: "flex items-center gap-2 text-[13px]" },
    h("span", { class: "w-12 text-slate-400 shrink-0" }, label),
    icon(ico, { size: 14, cls: "text-brand-400" }), value);
}

/* ---------- shared bits (exported for lens.js / pay.js etc) ---------- */
export function viewHead(eyebrow, title, em, lede) {
  return h("header", { class: "mb-7 fade-in" },
    h("span", { class: "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 text-brand-700 text-[12.5px] font-bold mb-4" },
      icon("sparkles", { size: 14 }), eyebrow),
    h("h1", { class: "text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight text-slate-900" },
      title, " ", h("span", { class: "gradient-text" }, em)),
    h("p", { class: "mt-3 text-[15px] text-slate-600 leading-relaxed max-w-3xl" }, lede));
}
export function sectionLabel(text, extra) {
  return h("div", { class: "flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400" + (extra || "") },
    h("span", { class: "w-1.5 h-1.5 rounded-full bg-brand-400" }), text);
}
export function redactBanner(ico, children, id) {
  const props = { class: "flex items-start gap-2.5 mt-3 p-3.5 rounded-2xl bg-brand-50/70 border border-brand-100 text-[12.5px] text-slate-600 leading-relaxed" };
  if (id) props.id = id;
  return h("div", props, icon(ico, { size: 15, cls: "text-brand-600 mt-0.5 shrink-0" }), h("div", { class: "flex-1" }, ...(Array.isArray(children) ? children : [children])));
}
