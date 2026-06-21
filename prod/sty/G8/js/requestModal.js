// Shared "ON Track 협찬 요청 생성" modal -> POST /api/sponsor/request.
import { h, icon, fmtKRW, swatch } from "./ui.js";
import { modal, toast } from "./overlay.js";
import { api, ApiError } from "./api.js";
import { CELEBRITIES, BRANDS } from "./config.js";
import { brandIdByName, brandName } from "./catalog.js";
import { go } from "./router.js";

// prefill: { garment, brandId, brandName, celebrityId, inventory:[{id,size,stock_count,showroom}] }
export function openRequestModal(prefill = {}) {
  const g = prefill.garment || null;
  const brandId = prefill.brandId || (g ? brandIdByName(g.brand) : "") || "";
  const inv = prefill.inventory || [];

  const celebSel = h("select", { id: "rq-celeb", required: true },
    h("option", { value: "" }, "셀러브리티 선택…"),
    ...CELEBRITIES.map(c => h("option", { value: c.id, selected: c.id === prefill.celebrityId }, `${c.name} (${c.ko})`)));

  const brandSel = h("select", { id: "rq-brand", required: true },
    h("option", { value: "" }, "브랜드 선택…"),
    ...BRANDS.map(b => h("option", { value: b.id, selected: b.id === brandId }, b.name)));

  const invSel = inv.length
    ? h("select", { id: "rq-inv" },
        h("option", { value: "" }, "자동 배정 (첫 예약 가능 재고)"),
        ...inv.map(i => h("option", { value: i.id },
          `${i.size} · 재고 ${i.stock_count} · ${i.showroom?.name || i.showroom_id}`)))
    : h("input", { type: "text", id: "rq-inv", placeholder: "선택사항 — 비우면 자동 배정", value: prefill.inventoryId || "" });

  const statusSel = h("select", { id: "rq-status" },
    h("option", { value: "requested", selected: true }, "요청됨 (requested)"),
    h("option", { value: "candidate" }, "후보 (candidate)"),
    h("option", { value: "reserved" }, "예약됨 (reserved)"));

  const pickup = h("input", { type: "date", id: "rq-pickup" });
  const ret = h("input", { type: "date", id: "rq-return" });
  const stylist = h("input", { type: "text", id: "rq-stylist", value: "stylist-001", required: true, maxlength: 120 });
  const notes = h("textarea", { id: "rq-notes", placeholder: "예: 6월 에디토리얼 풀, 화보 크레딧 확정" }, "");

  const header = g
    ? h("div", { class: "row", style: { gap: "12px", marginBottom: "4px" } },
        h("div", { style: { width: "46px", flex: "none" } }, swatch(g, { square: true })),
        h("div", null,
          h("div", { class: "gcard-brand" }, g.brand),
          h("div", { style: { fontFamily: "var(--font-disp)", fontSize: "16px" } }, g.name),
          h("div", { class: "muted mono", style: { fontSize: "11px" } }, g.id, " · ", fmtKRW(g.price_krw))))
    : null;

  const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "16px" } },
    header,
    g ? h("input", { type: "hidden", id: "rq-garment", value: g.id }) :
        h("div", { class: "field" }, h("label", { for: "rq-garment" }, "가먼트 ID"),
          h("input", { type: "text", id: "rq-garment", placeholder: "예: trench-beige-001", required: true })),
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { for: "rq-celeb" }, "셀러브리티"), celebSel),
      h("div", { class: "field" }, h("label", { for: "rq-brand" }, "브랜드"), brandSel)),
    h("div", { class: "field" }, h("label", { for: "rq-inv" }, "재고(인벤토리)"), invSel),
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { for: "rq-pickup" }, "픽업일"), pickup),
      h("div", { class: "field" }, h("label", { for: "rq-return" }, "반납일"), ret)),
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { for: "rq-stylist" }, "요청 스타일리스트 ID"), stylist),
      h("div", { class: "field" }, h("label", { for: "rq-status" }, "초기 상태"), statusSel)),
    h("div", { class: "field" }, h("label", { for: "rq-notes" }, "메모"), notes));

  const submitBtn = h("button", { class: "btn btn-signal", type: "submit", form: "rq-form" },
    icon("checkCircle", { size: 16 }), "요청 생성");

  // wrap body in a form so Enter submits
  const form = h("form", { id: "rq-form", onsubmit: (e) => { e.preventDefault(); submit(); } }, body);

  const ctl = modal({
    title: "협찬 요청 생성",
    sub: "ON Track 보드에 새 협찬 요청을 추가합니다 · POST /api/sponsor/request",
    body: form,
    footer: [
      h("button", { class: "btn btn-ghost", type: "button", onclick: () => ctl.close() }, "취소"),
      submitBtn,
    ],
  });

  async function submit() {
    const garment_id = (g ? g.id : document.getElementById("rq-garment").value).trim();
    const payload = {
      garment_id,
      brand_id: brandSel.value,
      celebrity_id: celebSel.value,
      requester_stylist_id: stylist.value.trim(),
      initial_status: statusSel.value,
      notes: notes.value.trim(),
    };
    const invVal = (invSel.value || "").trim();
    if (invVal) payload.inventory_id = invVal;
    if (pickup.value) payload.pickup_date = pickup.value;
    if (ret.value) payload.return_date = ret.value;

    if (!payload.garment_id || !payload.brand_id || !payload.celebrity_id || !payload.requester_stylist_id) {
      toast("가먼트 · 브랜드 · 셀러브리티 · 스타일리스트 ID는 필수입니다.", { type: "bad", title: "입력 확인" });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.replaceChildren(h("span", { class: "spin" }), "생성 중…");
    try {
      const out = await api.sponsorRequest(payload);
      ctl.close();
      toast(`요청 ${out.id} 생성됨 · 상태 ${out.status}`, {
        type: "ok", title: "협찬 요청 생성 완료",
      });
      setTimeout(() => go("track"), 300);
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.replaceChildren(icon("checkCircle", { size: 16 }), "요청 생성");
      const msg = err instanceof ApiError ? err.message : "요청 생성 실패";
      toast(msg, { type: "bad", title: "생성 실패" });
    }
  }

  return ctl;
}
