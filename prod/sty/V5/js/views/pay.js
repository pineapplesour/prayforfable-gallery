// ON Pay — receipt parsing wired to the LIVE backend:
// POST /api/pay/receipt -> { date, amount_krw, vendor, items[] }, plus
// GET /api/pay/export (CSV download). Text parse path is real.
import { h, icon, mount, chip, errorState, fmtKRW } from "../ui.js";
import { api } from "../api.js";
import { toast } from "../overlay.js";

const SAMPLE = [
  "ZARA Myeongdong",
  "Date: 2026-06-15",
  "Wool Coat 129,000",
  "Leather Belt 39,000",
  "Total 168,000",
].join("\n");

const SAMPLE_2 = [
  "Central PR Showroom",
  "날짜: 2026-06-12",
  "Trench loan prep 120,000",
  "Courier return 18,000",
  "합계 138,000",
].join("\n");

let busy = false;

export default {
  async render(root) {
    mount(root, view());
    return () => { busy = false; };
  },
};

function view() {
  const textInput = h("textarea", { id: "pay-text", class: "control", rows: 7,
    placeholder: "영수증 텍스트를 붙여넣으세요. 예:\nZARA Myeongdong\nDate: 2026-06-15\nWool Coat 129,000\nTotal 129,000", maxlength: 5000 }, SAMPLE);
  const urlInput = h("input", { type: "url", id: "pay-url", class: "control", placeholder: "https://…/receipt.jpg (이미지 OCR 시임)" });

  const form = h("div", { class: "panel panel-pad", style: { display: "flex", flexDirection: "column", gap: "16px" } },
    h("div", { class: "section-label" }, "영수증 입력"),
    h("div", { class: "field" },
      h("label", { for: "pay-text" }, "영수증 텍스트"),
      textInput,
      h("div", { class: "example-chips" },
        chip("샘플 A · ZARA", { onClick: () => { textInput.value = SAMPLE; urlInput.value = ""; } }),
        chip("샘플 B · 쇼룸", { onClick: () => { textInput.value = SAMPLE_2; urlInput.value = ""; } }))),
    h("div", { class: "field" },
      h("label", { for: "pay-url" }, "또는 이미지 URL ", h("span", { class: "muted" }, "(텍스트 미입력 시)")),
      urlInput),
    h("button", { class: "btn btn-primary btn-block", id: "pay-go", onclick: () => runParse() },
      icon("checkCircle", { size: 16 }), "영수증 파싱"),
    h("a", { class: "btn btn-ghost btn-block", href: api.payExportUrl(), target: "_blank", rel: "noopener", download: "styleon-pay.csv" },
      icon("arrowRight", { size: 15 }), "전체 내역 CSV 내보내기"));

  return h("section", { class: "view" },
    h("header", { class: "view-head" },
      h("div", { class: "eyebrow" }, "ON PAY · 08"),
      h("h1", { class: "view-title" }, "영수증을 ", h("em", null, "정산 데이터"), "로"),
      h("p", { class: "view-lede" }, "영수증 텍스트(또는 이미지)를 입력하면 일자·매장·금액·품목으로 파싱하여 정산 가능한 구조로 저장하고, 전체 내역을 CSV로 내보냅니다.")),
    h("div", { class: "sponsor-layout" },
      form,
      h("div", { id: "pay-result" }, placeholder())));
}

function placeholder() {
  return h("div", { class: "state" },
    icon("info", { size: 46, stroke: 1.2, cls: "state-ico" }),
    h("h3", null, "영수증을 파싱하세요"),
    h("p", null, "왼쪽에 영수증 텍스트를 입력하고 ‘영수증 파싱’을 누르면 결과가 여기에 표시됩니다."));
}

async function runParse() {
  if (busy) return;
  const text = (document.getElementById("pay-text").value || "").trim();
  const url = (document.getElementById("pay-url").value || "").trim();
  if (!text && !url) {
    mount(document.getElementById("pay-result"),
      errorState({ message: "영수증 텍스트 또는 이미지 URL을 입력하세요.", status: 0 }, null));
    return;
  }
  const payload = {};
  if (text) payload.receipt_text = text;
  else payload.image_url = url;

  const box = document.getElementById("pay-result");
  const btn = document.getElementById("pay-go");
  busy = true;
  if (btn) { btn.disabled = true; btn.replaceChildren(h("span", { class: "spin" }), "파싱 중…"); }
  mount(box, loadingResult());

  try {
    const res = await api.payReceipt(payload);
    mount(box, resultCard(res));
    toast(`영수증 ${res.receipt_id} 파싱 완료 · ${fmtKRW(res.amount_krw)}`, { type: "ok", title: "ON Pay" });
  } catch (err) {
    mount(box, errorState(err, () => runParse()));
  } finally {
    busy = false;
    if (btn) { btn.disabled = false; btn.replaceChildren(icon("checkCircle", { size: 16 }), "영수증 파싱"); }
  }
}

function loadingResult() {
  return h("div", { class: "panel panel-pad", style: { display: "flex", flexDirection: "column", gap: "14px" } },
    h("div", { class: "skel-line w40 shimmer", style: { height: "28px" } }),
    h("div", { class: "skel-line w90 shimmer", style: { height: "80px", marginTop: "8px" } }),
    h("div", { class: "skel-line w70 shimmer" }),
    h("div", { class: "skel-line w90 shimmer" }));
}

function resultCard(res) {
  const items = res.items || [];
  const itemsTable = items.length
    ? h("div", { class: "pay-items" },
        ...items.map(it => h("div", { class: "pay-item" },
          h("span", { class: "pay-item-name" }, it.name),
          h("span", { class: "pay-item-amt mono" }, fmtKRW(it.amount_krw)))))
    : h("div", { class: "muted", style: { fontSize: "13px" } }, "추출된 품목이 없습니다.");

  const seam = res.ocr_seam ? h("p", { class: "seam-note" }, icon("info", { size: 13 }), res.ocr_seam) : null;

  return h("div", { class: "panel panel-pad pay-receipt" },
    h("div", { class: "pay-head" },
      h("div", null,
        h("div", { class: "pay-vendor" }, res.vendor || "Unknown vendor"),
        h("div", { class: "pay-date mono muted" }, icon("info", { size: 12 }), " ", String(res.date))),
      h("span", { class: "pill ok" }, h("span", { class: "pdot" }), "파싱 완료")),
    h("div", { class: "pay-total" },
      h("span", { class: "pay-total-lbl" }, "합계"),
      h("span", { class: "pay-total-amt mono" }, fmtKRW(res.amount_krw))),
    h("div", { class: "section-label", style: { marginTop: "6px" } }, `품목 ${items.length}건`),
    itemsTable,
    h("div", { class: "pay-id mono muted" }, "영수증 ID · ", res.receipt_id),
    seam);
}
