// ON Sponsor — celebrity + brand (+garment) -> availability + manager channel.
// PII in the manager channel is role-gated; switching X-Role re-runs the check.
import { h, icon, mount, swatch, chip, availMeta, errorState, fmtKRW } from "../ui.js";
import { CELEBRITIES, BRANDS } from "../config.js";
import { api, ApiError } from "../api.js";
import { getRole, roleMeta } from "../store.js";
import { loadGarments, garmentById, brandName, celebName, celebKo, brandIdByName } from "../catalog.js";
import { openRequestModal } from "../requestModal.js";

let last = null;       // last check payload, for re-run on role change
let detach = null;

export default {
  async render(root, params) {
    mount(root, view(params));
    // populate garment selector from live catalog
    loadGarments().then(populateGarments).catch(showGarmentLoadError);
    // honor deep-link prefill from sourcing
    if (params.brand) {
      const bid = brandIdByName(params.brand);
      if (bid) document.getElementById("sp-brand").value = bid;
    }
    if (params.garment) {
      pendingGarment = params.garment;
      tryApplyGarment();
    }
    // re-run when role changes so redaction state updates live
    const handler = () => { if (last) runCheck(true); };
    document.addEventListener("role:applied", handler);
    detach = () => document.removeEventListener("role:applied", handler);
    return () => { detach?.(); detach = null; last = null; pendingGarment = null; };
  },
};

let pendingGarment = null;
function tryApplyGarment() {
  const selEl = document.getElementById("sp-garment");
  if (selEl && pendingGarment && [...selEl.options].some(o => o.value === pendingGarment)) {
    selEl.value = pendingGarment;
    const g = garmentById(pendingGarment);
    if (g) { document.getElementById("sp-brand").value = brandIdByName(g.brand) || document.getElementById("sp-brand").value; }
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
  if (selEl) {
    selEl.replaceChildren(h("option", { value: "" }, "가먼트 없음 (브랜드 전체)"));
  }
  const field = selEl?.closest(".field");
  if (!field) return;
  document.getElementById("sp-garment-error")?.remove();
  const message = err instanceof ApiError
    ? err.message
    : "가먼트 카탈로그를 불러오지 못했습니다.";
  field.append(h("div", { class: "redact", id: "sp-garment-error", style: { marginTop: "8px" } },
    icon("warn", { size: 15 }),
    h("span", null, message),
    h("button", { class: "btn btn-ghost btn-sm", onclick: retryLoadGarments },
      icon("refresh", { size: 14 }), "다시 시도")));
}

function retryLoadGarments() {
  const selEl = document.getElementById("sp-garment");
  if (selEl) {
    selEl.replaceChildren(h("option", { value: "" }, "카탈로그 불러오는 중…"));
  }
  document.getElementById("sp-garment-error")?.remove();
  loadGarments().then(populateGarments).catch(showGarmentLoadError);
}

function view(params) {
  const celebSel = h("select", { id: "sp-celeb" },
    ...CELEBRITIES.map(c => h("option", { value: c.id }, `${c.name} (${c.ko})`)));
  const brandSel = h("select", { id: "sp-brand" },
    ...BRANDS.map(b => h("option", { value: b.id }, b.name)));
  const garmentSel = h("select", { id: "sp-garment" }, h("option", { value: "" }, "카탈로그 불러오는 중…"));

  const form = h("div", { class: "panel panel-pad", style: { display: "flex", flexDirection: "column", gap: "16px" } },
    h("div", { class: "section-label" }, "협찬 가용성 조회"),
    h("div", { class: "field" }, h("label", { for: "sp-celeb" }, "셀러브리티"), celebSel),
    h("div", { class: "field" }, h("label", { for: "sp-brand" }, "브랜드"), brandSel),
    h("div", { class: "field" }, h("label", { for: "sp-garment" }, "가먼트 ", h("span", { class: "muted" }, "(선택)")), garmentSel),
    h("button", { class: "btn btn-primary btn-block", id: "sp-go", onclick: () => runCheck(false) },
      icon("spark", { size: 16 }), "가용성 확인"),
    roleNote());

  return h("section", { class: "view" },
    h("header", { class: "view-head" },
      h("div", { class: "eyebrow" }, "ON SPONSOR · 02"),
      h("h1", { class: "view-title" }, "협찬 ", h("em", null, "가능 여부"), "를 즉시 확인"),
      h("p", { class: "view-lede" }, "셀러브리티·브랜드(·가먼트) 조합의 협찬 가능 여부와 담당 매니저 연락 채널을 확인합니다. 연락처 PII는 역할(X-Role)에 따라 보호됩니다.")),
    h("div", { class: "sponsor-layout" },
      form,
      h("div", { id: "sp-result" }, placeholder())));
}

function roleNote() {
  const m = roleMeta(getRole());
  return h("div", { class: "redact", id: "sp-rolenote" },
    icon(getRole() === "stylist" ? "lock" : "info", { size: 15 }),
    h("span", null, "현재 역할 ", h("b", null, m.label), " · ", m.note,
      getRole() === "stylist" ? " — 우측 상단에서 역할을 바꿔 PII 노출 차이를 확인하세요." : ""));
}

function placeholder() {
  return h("div", { class: "state" },
    icon("spark", { size: 46, stroke: 1.2, cls: "state-ico" }),
    h("h3", null, "조합을 선택해 조회하세요"),
    h("p", null, "셀러브리티와 브랜드를 고르고 ‘가용성 확인’을 누르면 결과가 여기에 표시됩니다."));
}

async function runCheck(isRerun) {
  const celeb = document.getElementById("sp-celeb").value;
  const brand = document.getElementById("sp-brand").value;
  const garment = document.getElementById("sp-garment").value;
  last = { celebrity_id: celeb, brand_id: brand };
  if (garment) last.garment_id = garment;

  const box = document.getElementById("sp-result");
  const btn = document.getElementById("sp-go");
  if (!isRerun && btn) { btn.disabled = true; btn.replaceChildren(h("span", { class: "spin" }), "확인 중…"); }
  mount(box, loadingResult());

  try {
    const res = await api.sponsorCheck(last);
    mount(box, resultCard(res));
  } catch (err) {
    mount(box, errorState(err, () => runCheck(false)));
  } finally {
    if (btn) { btn.disabled = false; btn.replaceChildren(icon("spark", { size: 16 }), "가용성 확인"); }
    const note = document.getElementById("sp-rolenote");
    if (note) note.replaceWith(roleNote());
  }
}

function loadingResult() {
  return h("div", { class: "panel panel-pad", style: { display: "flex", flexDirection: "column", gap: "14px" } },
    h("div", { class: "skel-line w40 shimmer", style: { height: "28px" } }),
    h("div", { class: "skel-line w90 shimmer" }),
    h("div", { class: "skel-line w70 shimmer" }),
    h("div", { class: "skel-line w90 shimmer", style: { height: "60px", marginTop: "8px" } }));
}

function resultCard(res) {
  const meta = availMeta(res.availability);
  const g = res.garment_id ? garmentById(res.garment_id) : null;

  const verdict = h("div", { class: `verdict ${res.availability}` },
    h("div", { class: "verdict-state" },
      icon(meta.ico, { size: 40, stroke: 1.4, cls: "verdict-icon" }), meta.label),
    h("p", { class: "verdict-reason" }, res.reason),
    h("div", { class: "verdict-meta" },
      chip(celebName(res.celebrity_id) + (celebKo(res.celebrity_id) ? ` · ${celebKo(res.celebrity_id)}` : "")),
      chip(brandName(res.brand_id)),
      res.garment_id ? chip(g ? g.name : res.garment_id, { tag: false }) : chip("브랜드 전체 기준")));

  const channel = channelCard(res.manager_inquiry_channel);

  const actions = h("div", { class: "sponsor-actions" },
    h("button", { class: "btn btn-signal",
      disabled: res.availability === "unavailable",
      title: res.availability === "unavailable" ? "협찬 불가 조합입니다" : "",
      onclick: () => openRequestModal({
        garment: g, brandId: res.brand_id, brandName: brandName(res.brand_id), celebrityId: res.celebrity_id }) },
      icon("arrowRight", { size: 16 }), "이 조합으로 협찬 요청"),
    h("a", { class: "btn btn-ghost", href: "#/track" }, "ON Track 보기"));

  return h("div", { style: { display: "flex", flexDirection: "column", gap: "0" } }, verdict,
    h("div", { class: "channel" }, h("div", { class: "section-label" }, "담당 매니저 연락 채널"), channel), actions);
}

function channelCard(ch) {
  if (!ch) return h("div", { class: "muted" }, "연락 채널 정보 없음");
  const cm = ch.contact_manager || {};
  const refLabel = ch.ref_type === "brand" ? "브랜드 직접" : "쇼룸/에이전시";

  const head = h("div", { class: "contact-head" },
    h("div", null,
      h("div", { class: "contact-name" }, cm.name || "—"),
      h("div", { class: "contact-role" }, cm.role || "")),
    h("span", { class: "pill neutral" }, h("span", { class: "pdot" }), refLabel));

  let rows;
  if (cm.redacted) {
    rows = h("div", { class: "redact" },
      icon("lock", { size: 15 }),
      h("span", null, h("b", null, "연락처 PII 비공개"), " — 현재 역할(", roleMeta(getRole()).label,
        ")에서는 전화·이메일이 보호됩니다. ", h("b", null, "관리자"), " 또는 ", h("b", null, "쇼룸 파트너"), " 역할에서 열람 가능합니다."));
  } else {
    rows = h("div", { class: "contact-rows" },
      cm.phone ? h("div", { class: "cr" }, h("span", { class: "k" }, "전화"),
        icon("phone", { size: 14 }), h("a", { href: `tel:${cm.phone}` }, cm.phone)) : null,
      cm.email ? h("div", { class: "cr" }, h("span", { class: "k" }, "이메일"),
        icon("mail", { size: 14 }), h("a", { href: `mailto:${cm.email}` }, cm.email)) : null);
  }

  const showroom = ch.showroom
    ? h("div", { class: "contact-rows", style: { borderTop: "1px solid var(--line)", paddingTop: "10px" } },
        h("div", { class: "cr" }, h("span", { class: "k" }, "쇼룸"), icon("building", { size: 14 }), h("span", null, ch.showroom.name)),
        ch.showroom.location ? h("div", { class: "cr" }, h("span", { class: "k" }, "위치"), icon("pin", { size: 14 }), h("span", null, ch.showroom.location)) : null,
        ch.showroom.notes ? h("div", { class: "cr muted", style: { fontSize: "12px" } }, h("span", { class: "k" }, "메모"), h("span", null, ch.showroom.notes)) : null)
    : null;

  return h("div", { class: "contact-card" },
    head,
    h("div", { class: "kv" }, h("span", { class: "k" }, "브랜드"), h("span", null, ch.brand_name || "—")),
    rows, showroom);
}
