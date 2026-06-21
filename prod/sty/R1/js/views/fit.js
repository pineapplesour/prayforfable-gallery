// ON Fit — virtual try-on wired to the LIVE backend (/api/fit/*). 플래그십.
//   1) GET  /api/fit/subjects   2) pick garments
//   3) POST /api/fit/render → 202   4) poll GET /api/fit/jobs/{id} (~60s)
// Re:Connect 룩: 좌측 둥근 글래스 셀렉터 + 우측 다크 시네마틱 stage(violet glow).
import { h, icon, mount, swatch, errorState, emptyState } from "../ui.js";
import { API_BASE } from "../config.js";
import { loadGarments, getGarments } from "../catalog.js";
import { api } from "../api.js";
import { toast, modal } from "../overlay.js";
import { viewHead, sectionLabel } from "./sponsor.js";

const MAX_GARMENTS = 8;
const POLL_MS = 2200;
const POLL_TIMEOUT_MS = 150000;

let subjects = [];
let selSubjectId = null;
let custom = null;
const picked = new Set();
let runSeq = 0;
let ticker = null;

export default {
  async render(root) {
    mount(root, shell());
    loadSubjects();
    loadGarments().then(paintGarments).catch(err => {
      const box = document.getElementById("fit-garments");
      if (box) mount(box, errorState(err, () => loadGarments().then(paintGarments)));
    });
    return () => { runSeq++; stopTicker(); picked.clear(); };
  },
};

/* ---------------- layout ---------------- */
function shell() {
  return h("div", null,
    viewHead("ON FIT · 04", "가상", "트라이온 미리보기",
      "예시 인물과 의상을 선택해 실제 착장 이미지를 생성합니다. 생성은 비동기 작업(요청 → 폴링 → 이미지)으로 동작하며 보통 1분 정도 걸립니다."),
    h("div", { class: "grid lg:grid-cols-[380px_1fr] gap-6 items-start" },
      h("div", { class: "rounded-[2rem] border border-slate-100 bg-white shadow-soft p-6 flex flex-col gap-6" },
        h("div", null,
          h("div", { class: "mb-3" }, sectionLabel("1 · 대상 선택")),
          h("div", { class: "grid grid-cols-3 gap-2.5", id: "fit-subjects" },
            h("div", { class: "col-span-3 text-[13px] text-slate-400 py-3" }, "예시 인물 불러오는 중…"))),
        h("div", null,
          h("div", { class: "mb-1 flex items-center justify-between" },
            sectionLabel("2 · 의상 선택"),
            h("span", { class: "text-[12px] font-semibold text-brand-600", id: "fit-count" }, "")),
          h("div", { class: "text-[12px] text-slate-400 mb-2.5" }, `입힐 의상을 최대 ${MAX_GARMENTS}개까지 선택하세요.`),
          h("div", { class: "grid grid-cols-4 sm:grid-cols-5 gap-2.5 max-h-[260px] overflow-y-auto no-scrollbar pr-1", id: "fit-garments" },
            h("div", { class: "col-span-full text-[13px] text-slate-400 py-3" }, "카탈로그 불러오는 중…"))),
        h("button", { class: "btn btn-signal btn-block", id: "fit-go", onclick: generate },
          icon("wand", { size: 16 }), "트라이온 생성")),
      h("div", { class: "lg:sticky lg:top-[88px]", id: "fit-stage" }, idleStage())));
}

/* ---------------- subjects ---------------- */
function loadSubjects() {
  const box = document.getElementById("fit-subjects");
  api.fitSubjects()
    .then(res => {
      subjects = res.subjects || [];
      if (!selSubjectId && !custom && subjects[0]) selSubjectId = subjects[0].id;
      paintSubjects();
    })
    .catch(err => { if (box) mount(box, h("div", { class: "col-span-3" }, errorState(err, loadSubjects))); });
}
function paintSubjects() {
  const box = document.getElementById("fit-subjects");
  if (!box) return;
  const cards = subjects.map(subjectCard);
  if (custom) cards.unshift(customCard());
  cards.push(uploadCard());
  mount(box, ...cards);
}
function subjBtnClass(sel) {
  return "relative aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all " +
    (sel ? "border-brand-600 ring-2 ring-brand-200 shadow-glow" : "border-transparent hover:border-brand-200");
}
function subjectCard(s) {
  const sel = !custom && s.id === selSubjectId;
  return h("button", { class: subjBtnClass(sel), type: "button", title: s.label, "aria-pressed": String(sel),
    onclick: () => { selSubjectId = s.id; custom = null; paintSubjects(); } },
    h("img", { class: "absolute inset-0 w-full h-full object-cover", src: API_BASE + s.image_url, alt: s.label, loading: "lazy", decoding: "async" }),
    sel ? h("span", { class: "absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center" }, icon("check", { size: 12 })) : null,
    h("span", { class: "absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-[10.5px] font-semibold text-white text-left leading-tight" }, shortLabel(s.label)));
}
function customCard() {
  const sel = !!custom;
  return h("button", { class: subjBtnClass(sel), type: "button", title: custom.label, "aria-pressed": String(sel),
    onclick: () => { selSubjectId = null; paintSubjects(); } },
    h("img", { class: "absolute inset-0 w-full h-full object-cover", src: custom.image, alt: custom.label }),
    sel ? h("span", { class: "absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center" }, icon("check", { size: 12 })) : null,
    h("span", { class: "absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-[10.5px] font-semibold text-white text-left flex items-center justify-between" },
      custom.label,
      h("span", { class: "w-4 h-4 rounded-full bg-white/30 flex items-center justify-center", title: "제거", role: "button",
        onclick: (e) => { e.stopPropagation(); custom = null; if (!selSubjectId && subjects[0]) selSubjectId = subjects[0].id; paintSubjects(); } }, "×")));
}
function uploadCard() {
  return h("button", { class: "aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-200 hover:border-brand-300 hover:bg-brand-50/40 flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-brand-500 transition-colors",
    type: "button", onclick: openUpload, title: "내 사진으로 트라이온" },
    icon("layers", { size: 22, stroke: 1.6 }),
    h("span", { class: "text-[10.5px] font-semibold" }, "직접 업로드"));
}

function openUpload() {
  let fileUrl = null; let chosenName = "";
  const preview = h("img", { class: "w-full rounded-xl border border-slate-100", alt: "", style: { display: "none" } });
  const note = h("div", { class: "text-[12px] text-slate-400 leading-relaxed" },
    "공개 이미지 URL을 입력하면 백엔드가 ", h("code", { class: "mono text-brand-600" }, "subject_ref"), "로 가져와 합성합니다. ",
    "로컬 파일 선택은 미리보기 전용입니다(서버 합성에는 URL 필요).");
  const urlInput = h("input", { type: "url", class: "control", placeholder: "https://…/photo.jpg",
    oninput: () => { const v = urlInput.value.trim(); if (v) showPreview(v); } });
  const fileInput = h("input", { type: "file", accept: "image/*", class: "control",
    onchange: () => {
      const f = fileInput.files && fileInput.files[0]; if (!f) return;
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      fileUrl = URL.createObjectURL(f); chosenName = f.name; showPreview(fileUrl);
    } });
  function showPreview(src) { preview.src = src; preview.style.display = "block"; }

  const body = h("div", { class: "flex flex-col gap-4" },
    h("div", { class: "field" }, h("label", null, "이미지 URL"), urlInput),
    h("div", { class: "text-[12px] text-slate-400 text-center" }, "또는"),
    h("div", { class: "field" }, h("label", null, "로컬 파일 (미리보기)"), fileInput),
    preview, note);

  const dlg = modal({
    title: "내 사진으로 트라이온", sub: "예시 인물 대신 직접 준비한 인물 사진을 사용합니다.", body,
    footer: [
      h("button", { class: "btn btn-ghost", onclick: () => dlg.close() }, "취소"),
      h("button", { class: "btn btn-signal", onclick: useCustom }, "이 대상 사용")],
  });

  function useCustom() {
    const url = urlInput.value.trim();
    if (url) custom = { ref: url, image: url, label: "내 사진 (URL)" };
    else if (fileUrl) custom = { ref: null, image: fileUrl, label: chosenName || "내 사진" };
    else { toast("이미지 URL을 입력하거나 파일을 선택하세요.", { type: "bad", title: "입력 필요" }); return; }
    selSubjectId = null; paintSubjects(); dlg.close();
  }
}

function shortLabel(label) { const m = /-\s*(.+)$/.exec(label); return m ? m[1] : label; }

/* ---------------- garments ---------------- */
function paintGarments() {
  const box = document.getElementById("fit-garments");
  if (!box) return;
  const gs = getGarments();
  if (!gs.length) { mount(box, h("div", { class: "col-span-full" }, emptyState({ title: "의상이 없습니다", ico: "empty" }))); return; }
  mount(box, ...gs.map(g =>
    h("div", { class: "relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all " +
        (picked.has(g.id) ? "border-brand-600 ring-2 ring-brand-200" : "border-transparent hover:border-brand-200"),
      dataset: { g: g.id }, title: `${g.name} — ${g.brand}`, onclick: () => toggle(g.id) },
      swatch(g, { square: true }),
      h("div", { class: "ft-check absolute top-1 right-1 w-4 h-4 rounded-full bg-brand-600 text-white items-center justify-center " + (picked.has(g.id) ? "flex" : "hidden") }, icon("check", { size: 11 })))));
  updateCount();
}
function toggle(id) {
  if (picked.has(id)) picked.delete(id);
  else {
    if (picked.size >= MAX_GARMENTS) { toast(`의상은 최대 ${MAX_GARMENTS}개까지 선택할 수 있습니다.`, { type: "bad", title: "선택 제한" }); return; }
    picked.add(id);
  }
  const tile = document.querySelector(`[data-g="${CSS.escape(id)}"]`);
  if (tile) {
    const on = picked.has(id);
    tile.classList.toggle("border-brand-600", on);
    tile.classList.toggle("ring-2", on);
    tile.classList.toggle("ring-brand-200", on);
    tile.classList.toggle("border-transparent", !on);
    const chk = tile.querySelector(".ft-check");
    if (chk) { chk.classList.toggle("flex", on); chk.classList.toggle("hidden", !on); }
  }
  updateCount();
}
function updateCount() {
  const c = document.getElementById("fit-count");
  if (c) c.textContent = picked.size ? `${picked.size}개 선택됨` : "";
}

/* ---------------- stages ---------------- */
function stageWrap(...children) {
  return h("div", { class: "rounded-[2rem] overflow-hidden bg-slate-900 shadow-soft relative min-h-[440px] flex flex-col" },
    h("div", { class: "absolute -top-20 -right-20 w-72 h-72 bg-brand-600/30 blur-3xl rounded-full pointer-events-none" }),
    h("div", { class: "absolute -bottom-24 -left-16 w-72 h-72 bg-indigo-600/20 blur-3xl rounded-full pointer-events-none" }),
    ...children);
}
function idleStage() {
  return stageWrap(
    h("div", { class: "relative flex-1 flex flex-col items-center justify-center gap-3 p-10 text-center" },
      h("div", { class: "w-16 h-16 rounded-2xl bg-white/10 text-brand-300 flex items-center justify-center" }, icon("wand", { size: 30 })),
      h("h3", { class: "text-xl font-extrabold tracking-tight text-white" }, "대상과 의상을 선택하세요"),
      h("p", { class: "text-[14px] text-slate-400 max-w-xs" }, "선택 후 ‘트라이온 생성’을 누르면 실제 착장 이미지가 합성됩니다.")));
}
function loadingStage() {
  return stageWrap(
    h("div", { class: "relative flex-1 flex flex-col items-center justify-center gap-5 p-10 text-center" },
      h("div", { class: "flex items-center gap-3 text-white font-bold" },
        h("span", { class: "spin spin-lg on-dark" }),
        h("span", { id: "fit-status" }, "작업 생성 중…")),
      h("div", { class: "w-full max-w-xs" },
        h("div", { class: "fit-bar !bg-white/15" }, h("span", { id: "fit-bar-fill", style: { width: "6%" } }))),
      h("div", { class: "mono text-[13px] text-brand-300", id: "fit-elapsed" }, "0초 경과"),
      h("div", { class: "text-[12px] text-slate-400" }, "보통 1분 정도 걸립니다. 잠시만 기다려 주세요.")));
}
function resultStage(imageUrl, garmentIds, { cacheHit = false } = {}) {
  const gs = getGarments();
  const chosen = garmentIds.map(id => gs.find(g => g.id === id)).filter(Boolean);
  const subjLabel = custom ? custom.label : (shortLabel(subjects.find(s => s.id === selSubjectId)?.label || selSubjectId || ""));

  return stageWrap(
    h("div", { class: "relative flex-1 flex items-center justify-center p-5" },
      h("img", { class: "max-h-[460px] w-auto rounded-2xl shadow-glow object-contain", src: API_BASE + imageUrl, alt: "가상 트라이온 결과" })),
    h("div", { class: "relative border-t border-white/10 p-5" },
      h("div", { class: "flex flex-wrap gap-2 mb-4" },
        h("span", { class: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[12px] font-bold" }, h("span", { class: "w-1.5 h-1.5 rounded-full bg-emerald-400" }), "생성 완료"),
        cacheHit ? h("span", { class: "inline-flex items-center px-3 py-1.5 rounded-full bg-white/10 text-slate-300 text-[12px] font-semibold" }, "캐시됨") : null,
        h("span", { class: "inline-flex items-center px-3 py-1.5 rounded-full bg-white/10 text-slate-300 text-[12px] font-semibold" }, subjLabel),
        ...chosen.map(g => h("span", { class: "inline-flex items-center px-3 py-1.5 rounded-full bg-brand-600/30 text-brand-200 text-[12px] font-semibold" }, g.name))),
      h("div", { class: "flex gap-2.5" },
        h("button", { class: "btn btn-signal", onclick: generate }, icon("wand", { size: 15 }), "다시 생성"),
        h("a", { class: "btn btn-dark", href: API_BASE + imageUrl, target: "_blank", rel: "noopener" }, icon("arrowUpRight", { size: 15 }), "원본 보기"))));
}
function errorStage(node) {
  return stageWrap(h("div", { class: "relative flex-1 flex items-center justify-center p-6" }, h("div", { class: "w-full max-w-md" }, node)));
}

/* ---------------- render flow ---------------- */
async function generate() {
  const garmentIds = [...picked].slice(0, MAX_GARMENTS);
  if (!selSubjectId && !custom) { toast("대상(예시 인물 또는 내 사진)을 선택하세요.", { type: "bad", title: "선택 필요" }); return; }
  if (!garmentIds.length) { toast("의상을 1개 이상 선택하세요.", { type: "bad", title: "선택 필요" }); return; }

  const payload = { garment_ids: garmentIds, quality: "low" };
  if (custom) {
    if (!custom.ref) { toast("로컬 파일은 미리보기 전용입니다. 서버 합성에는 공개 이미지 URL이 필요합니다.", { type: "bad", title: "URL 필요" }); return; }
    payload.subject_ref = custom.ref;
  } else payload.subject_id = selSubjectId;

  const myRun = ++runSeq;
  const stage = document.getElementById("fit-stage");
  const btn = document.getElementById("fit-go");
  if (btn) btn.disabled = true;
  mount(stage, loadingStage());

  const startedAt = Date.now();
  let status = "queued";
  startTicker(() => ({ startedAt, status }));

  const done = (node, { ok = false, isError = false } = {}) => {
    if (myRun !== runSeq) return;
    stopTicker();
    if (btn) btn.disabled = false;
    mount(document.getElementById("fit-stage"), isError ? errorStage(node) : node);
    if (ok) toast("가상 트라이온 생성 완료", { type: "ok" });
  };

  try {
    const created = await api.fitRender(payload);
    if (myRun !== runSeq) return;
    status = created.status || "queued";
    if (status === "done" && created.result_image_url) {
      done(resultStage(created.result_image_url, garmentIds, { cacheHit: created.cache_hit }), { ok: true });
      return;
    }
    const jobId = created.job_id;
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let transientErrors = 0;
    while (Date.now() < deadline) {
      await wait(POLL_MS);
      if (myRun !== runSeq) return;
      let job;
      try { job = await api.fitJob(jobId, { quiet: true }); transientErrors = 0; }
      catch (e) { if (++transientErrors >= 5) throw e; continue; }
      if (myRun !== runSeq) return;
      status = job.status;
      if (status === "done") {
        if (job.result_image_url) done(resultStage(job.result_image_url, garmentIds, { cacheHit: job.cache_hit }), { ok: true });
        else done(errorState({ message: "이미지 URL이 비어 있습니다.", status: 0 }, generate), { isError: true });
        return;
      }
      if (status === "failed") {
        done(errorState({ message: job.error || "생성에 실패했습니다.", status: 0 }, generate), { isError: true });
        toast("생성에 실패했습니다.", { type: "bad", title: "ON Fit" });
        return;
      }
    }
    done(errorState({ message: "시간이 초과되었습니다. 잠시 후 다시 시도하세요.", status: 0 }, generate), { isError: true });
  } catch (err) {
    done(errorState(err, generate), { isError: true });
  }
}

/* ---------------- progress ticker ---------------- */
function startTicker(getState) {
  stopTicker();
  const update = () => {
    const { startedAt, status } = getState();
    const sec = Math.floor((Date.now() - startedAt) / 1000);
    const elapsed = document.getElementById("fit-elapsed");
    const fill = document.getElementById("fit-bar-fill");
    const label = document.getElementById("fit-status");
    if (elapsed) elapsed.textContent = `${sec}초 경과`;
    if (label) label.textContent = status === "running" ? "합성 렌더링 중…" : status === "queued" ? "대기열 등록됨…" : "이미지 수신 중…";
    if (fill) { const pct = Math.min(94, 6 + (sec / 72) * 88); fill.style.width = pct.toFixed(1) + "%"; }
  };
  update();
  ticker = setInterval(update, 1000);
}
function stopTicker() { if (ticker) { clearInterval(ticker); ticker = null; } }
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
