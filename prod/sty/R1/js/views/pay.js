// ON Pay — receipt parsing wired to the LIVE backend:
// POST /api/pay/receipt + GET /api/pay/export (CSV). (Re:Connect 룩)
import { h, icon, mount, chip, errorState, fmtKRW } from "../ui.js";
import { api } from "../api.js";
import { toast } from "../overlay.js";
import { viewHead, sectionLabel } from "./sponsor.js";

const SAMPLE = ["ZARA Myeongdong", "Date: 2026-06-15", "Wool Coat 129,000", "Leather Belt 39,000", "Total 168,000"].join("\n");
const SAMPLE_2 = ["Central PR Showroom", "날짜: 2026-06-12", "Trench loan prep 120,000", "Courier return 18,000", "합계 138,000"].join("\n");

let busy = false;

export default {
  async render(root) { mount(root, view()); return () => { busy = false; }; },
};

function view() {
  const textInput = h("textarea", { id: "pay-text", class: "control", rows: 7,
    placeholder: "영수증 텍스트를 붙여넣으세요.", maxlength: 5000 }, SAMPLE);
  const urlInput = h("input", { type: "url", id: "pay-url", class: "control", placeholder: "https://…/receipt.jpg (이미지 OCR 시임)" });

  const form = h("div", { class: "rounded-[2rem] border border-slate-100 bg-white shadow-soft p-6 flex flex-col gap-4" },
    sectionLabel("영수증 입력"),
    h("div", { class: "field" },
      h("label", { for: "pay-text" }, "영수증 텍스트"),
      textInput,
      h("div", { class: "flex flex-wrap gap-2 mt-1" },
        chip("샘플 A · ZARA", { onClick: () => { textInput.value = SAMPLE; urlInput.value = ""; } }),
        chip("샘플 B · 쇼룸", { onClick: () => { textInput.value = SAMPLE_2; urlInput.value = ""; } }))),
    h("div", { class: "field" },
      h("label", { for: "pay-url" }, "또는 이미지 URL ", h("span", { class: "text-slate-400" }, "(텍스트 미입력 시)")),
      urlInput),
    h("button", { class: "btn btn-primary btn-block", id: "pay-go", onclick: () => runParse() },
      icon("checkCircle", { size: 16 }), "영수증 파싱"),
    h("a", { class: "btn btn-ghost btn-block", href: api.payExportUrl(), target: "_blank", rel: "noopener", download: "styleon-pay.csv" },
      icon("arrowUpRight", { size: 15 }), "전체 내역 CSV 내보내기"));

  return h("div", null,
    viewHead("ON PAY · 08", "영수증을", "정산 데이터로",
      "영수증 텍스트(또는 이미지)를 입력하면 일자·매장·금액·품목으로 파싱하여 정산 가능한 구조로 저장하고, 전체 내역을 CSV로 내보냅니다."),
    h("div", { class: "grid lg:grid-cols-[400px_1fr] gap-6 items-start" },
      form, h("div", { id: "pay-result" }, placeholder())));
}

function placeholder() {
  return h("div", { class: "rounded-[2rem] border border-slate-100 bg-white/70 shadow-card p-10 text-center flex flex-col items-center gap-3 min-h-[300px] justify-center" },
    h("div", { class: "w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center" }, icon("receipt", { size: 30 })),
    h("h3", { class: "text-lg font-extrabold tracking-tight text-slate-800" }, "영수증을 파싱하세요"),
    h("p", { class: "text-sm text-slate-500 max-w-sm" }, "왼쪽에 영수증 텍스트를 입력하고 ‘영수증 파싱’을 누르면 결과가 여기에 표시됩니다."));
}

async function runParse() {
  if (busy) return;
  const text = (document.getElementById("pay-text").value || "").trim();
  const url = (document.getElementById("pay-url").value || "").trim();
  if (!text && !url) {
    mount(document.getElementById("pay-result"), errorState({ message: "영수증 텍스트 또는 이미지 URL을 입력하세요.", status: 0 }, null));
    return;
  }
  const payload = {};
  if (text) payload.receipt_text = text; else payload.image_url = url;

  const box = document.getElementById("pay-result");
  const btn = document.getElementById("pay-go");
  busy = true;
  if (btn) { btn.disabled = true; btn.replaceChildren(h("span", { class: "spin on-dark" }), "파싱 중…"); }
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
  return h("div", { class: "rounded-[2rem] border border-slate-100 bg-white shadow-card p-6 flex flex-col gap-4" },
    h("div", { class: "skel-line w40 shimmer", style: { height: "28px" } }),
    h("div", { class: "skel-line w90 shimmer", style: { height: "80px", marginTop: "8px" } }),
    h("div", { class: "skel-line w70 shimmer" }),
    h("div", { class: "skel-line w90 shimmer" }));
}

function resultCard(res) {
  const items = res.items || [];
  const itemsTable = items.length
    ? h("div", { class: "flex flex-col divide-y divide-slate-100 rounded-2xl border border-slate-100 overflow-hidden" },
        ...items.map(it => h("div", { class: "flex items-center justify-between gap-3 px-4 py-3 bg-white" },
          h("span", { class: "text-[14px] text-slate-700" }, it.name),
          h("span", { class: "mono text-[14px] font-semibold text-slate-800" }, fmtKRW(it.amount_krw)))))
    : h("div", { class: "text-[13px] text-slate-400" }, "추출된 품목이 없습니다.");

  const seam = res.ocr_seam ? h("p", { class: "flex items-center gap-2 mt-4 text-[12.5px] text-slate-400" }, icon("info", { size: 13 }), res.ocr_seam) : null;

  return h("div", { class: "rounded-[2rem] border border-slate-100 bg-white shadow-card p-6 fade-in" },
    h("div", { class: "flex items-start justify-between gap-3" },
      h("div", null,
        h("div", { class: "text-xl font-extrabold tracking-tight text-slate-800" }, res.vendor || "Unknown vendor"),
        h("div", { class: "flex items-center gap-1.5 mono text-[12.5px] text-slate-400 mt-0.5" }, icon("calendar", { size: 13 }), String(res.date))),
      h("span", { class: "pill ok" }, h("span", { class: "pdot" }), "파싱 완료")),
    h("div", { class: "flex items-center justify-between gap-3 my-5 p-4 rounded-2xl bg-brand-50/60 border border-brand-100" },
      h("span", { class: "text-[13px] font-bold text-brand-700" }, "합계"),
      h("span", { class: "mono text-2xl font-extrabold text-brand-700" }, fmtKRW(res.amount_krw))),
    h("div", { class: "mb-3" }, sectionLabel(`품목 ${items.length}건`)),
    itemsTable,
    h("div", { class: "mono text-[11px] text-slate-300 mt-4" }, "영수증 ID · ", res.receipt_id),
    seam);
}
