// ON Fit — virtual try-on wired to the LIVE backend (/api/fit/*).
//   1) GET  /api/fit/subjects      → example people (selectable thumbnails) + "upload your own"
//   2) pick garments from the live catalog
//   3) POST /api/fit/render        → 202 { job_id, status, cache_hit, result_image_url? }
//   4) poll GET /api/fit/jobs/{id} (~60s, tasteful loading) → show the composed image
// Switching people / garments and re-rendering is supported; cached renders return instantly.
import { h, icon, mount, swatch, errorState, emptyState } from "../ui.js";
import { API_BASE } from "../config.js";
import { loadGarments, getGarments } from "../catalog.js";
import { api } from "../api.js";
import { toast, modal } from "../overlay.js";

const MAX_GARMENTS = 8;            // backend FitRenderRequest cap
const POLL_MS = 2200;             // poll cadence
const POLL_TIMEOUT_MS = 150000;   // hard stop (~2.5min) — a real render is ~60s

let subjects = [];                 // [{ id, label, image_url }]
let selSubjectId = null;           // selected example-person id
let custom = null;                 // { ref, image, label } when the user supplies their own (subject_ref)
const picked = new Set();          // selected garment ids

let runSeq = 0;                    // monotonic token; supersedes stale renders/polls
let ticker = null;                 // 1s elapsed/progress updater

export default {
  async render(root) {
    mount(root, shell());

    // 1) example people
    loadSubjects();
    // 2) garment catalog
    loadGarments().then(paintGarments).catch(err => {
      const box = document.getElementById("fit-garments");
      if (box) mount(box, errorState(err, () => loadGarments().then(paintGarments)));
    });

    // teardown: cancel any in-flight poll loop + ticker when leaving the view
    return () => { runSeq++; stopTicker(); picked.clear(); };
  },
};

/* ---------------- layout ---------------- */
function shell() {
  return h("section", { class: "view" },
    h("header", { class: "view-head" },
      h("div", { class: "eyebrow" }, "ON FIT · 04"),
      h("h1", { class: "view-title" }, "가상 ", h("em", null, "트라이온"), " 미리보기"),
      h("p", { class: "view-lede" },
        "예시 인물과 의상을 선택해 실제 착장 이미지를 생성합니다. 생성은 비동기 작업(요청 → 폴링 → 이미지)으로 동작하며 보통 1분 정도 걸립니다.")),
    h("div", { class: "fit-layout" },
      h("div", { class: "panel panel-pad", style: { display: "flex", flexDirection: "column", gap: "20px" } },
        h("div", null,
          h("div", { class: "section-label" }, "1 · 대상 선택"),
          h("div", { class: "subject-grid", id: "fit-subjects" },
            h("div", { class: "muted", style: { padding: "12px", gridColumn: "1 / -1" } }, "예시 인물 불러오는 중…"))),
        h("div", null,
          h("div", { class: "section-label" }, "2 · 의상 선택 ",
            h("span", { class: "muted", id: "fit-count" }, "")),
          h("div", { class: "muted", style: { fontSize: "12px", margin: "-4px 0 8px" } },
            `입힐 의상을 최대 ${MAX_GARMENTS}개까지 선택하세요.`),
          h("div", { class: "fit-garment-pick", id: "fit-garments" },
            h("div", { class: "muted", style: { padding: "12px" } }, "카탈로그 불러오는 중…"))),
        h("button", { class: "btn btn-signal btn-block", id: "fit-go", onclick: generate },
          icon("wand", { size: 16 }), "트라이온 생성")),
      h("div", { class: "fit-stage", id: "fit-stage" }, idleStage())));
}

/* ---------------- subjects (example people + upload) ---------------- */
function loadSubjects() {
  const box = document.getElementById("fit-subjects");
  api.fitSubjects()
    .then(res => {
      subjects = res.subjects || [];
      if (!selSubjectId && !custom && subjects[0]) selSubjectId = subjects[0].id;
      paintSubjects();
    })
    .catch(err => { if (box) mount(box, h("div", { style: { gridColumn: "1 / -1" } }, errorState(err, loadSubjects))); });
}

function paintSubjects() {
  const box = document.getElementById("fit-subjects");
  if (!box) return;
  const cards = subjects.map(subjectCard);
  if (custom) cards.unshift(customCard());
  cards.push(uploadCard());
  mount(box, ...cards);
}

function subjectCard(s) {
  const sel = !custom && s.id === selSubjectId;
  return h("button", { class: "subj-card" + (sel ? " is-sel" : ""), type: "button",
    title: s.label, "aria-pressed": String(sel),
    onclick: () => { selSubjectId = s.id; custom = null; paintSubjects(); } },
    h("img", { class: "subj-img", src: API_BASE + s.image_url, alt: s.label, loading: "lazy", decoding: "async" }),
    h("span", { class: "subj-check" }, icon("check", { size: 12 })),
    h("span", { class: "subj-cap" }, shortLabel(s.label)));
}

function customCard() {
  const sel = !!custom;
  return h("button", { class: "subj-card" + (sel ? " is-sel" : ""), type: "button",
    title: custom.label, "aria-pressed": String(sel),
    onclick: () => { selSubjectId = null; paintSubjects(); } },
    h("img", { class: "subj-img", src: custom.image, alt: custom.label }),
    h("span", { class: "subj-check" }, icon("check", { size: 12 })),
    h("span", { class: "subj-cap" }, custom.label,
      h("span", { class: "subj-x", title: "제거", role: "button",
        onclick: (e) => { e.stopPropagation(); custom = null; if (!selSubjectId && subjects[0]) selSubjectId = subjects[0].id; paintSubjects(); } }, "×")));
}

function uploadCard() {
  return h("button", { class: "subj-card subj-upload", type: "button", onclick: openUpload, title: "내 사진으로 트라이온" },
    icon("layers", { size: 22, stroke: 1.4 }),
    h("span", { class: "subj-cap" }, "직접 업로드"));
}

function openUpload() {
  let fileUrl = null;          // object URL (local preview only)
  let chosenName = "";
  const preview = h("img", { class: "up-preview", alt: "", style: { display: "none" } });
  const note = h("div", { class: "muted", style: { fontSize: "12px", lineHeight: "1.5" } },
    "공개 이미지 URL을 입력하면 백엔드가 ", h("code", null, "subject_ref"), "로 가져와 합성합니다. ",
    "로컬 파일 선택은 미리보기 전용입니다(서버 합성에는 URL 필요).");

  const urlInput = h("input", { type: "url", class: "control", placeholder: "https://…/photo.jpg",
    oninput: () => { const v = urlInput.value.trim(); if (v) showPreview(v); } });
  const fileInput = h("input", { type: "file", accept: "image/*", class: "control",
    onchange: () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      fileUrl = URL.createObjectURL(f);
      chosenName = f.name;
      showPreview(fileUrl);
    } });

  function showPreview(src) { preview.src = src; preview.style.display = "block"; }

  const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } },
    h("div", { class: "field" }, h("label", null, "이미지 URL"), urlInput),
    h("div", { class: "muted", style: { fontSize: "12px", textAlign: "center" } }, "또는"),
    h("div", { class: "field" }, h("label", null, "로컬 파일 (미리보기)"), fileInput),
    preview, note);

  const dlg = modal({
    title: "내 사진으로 트라이온",
    sub: "예시 인물 대신 직접 준비한 인물 사진을 사용합니다.",
    body,
    footer: h("div", { class: "row", style: { justifyContent: "flex-end", gap: "8px" } },
      h("button", { class: "btn btn-ghost", onclick: () => dlg.close() }, "취소"),
      h("button", { class: "btn btn-signal", onclick: useCustom }, "이 대상 사용")),
  });

  function useCustom() {
    const url = urlInput.value.trim();
    if (url) {
      custom = { ref: url, image: url, label: "내 사진 (URL)" };
    } else if (fileUrl) {
      // local file: preview-only — backend renders by reference, so no ref to send
      custom = { ref: null, image: fileUrl, label: chosenName || "내 사진" };
    } else {
      toast("이미지 URL을 입력하거나 파일을 선택하세요.", { type: "bad", title: "입력 필요" });
      return;
    }
    selSubjectId = null;
    paintSubjects();
    dlg.close();
  }
}

function shortLabel(label) {
  // "Example Person - City Neutral" → "City Neutral"
  const m = /-\s*(.+)$/.exec(label);
  return m ? m[1] : label;
}

/* ---------------- garments ---------------- */
function paintGarments() {
  const box = document.getElementById("fit-garments");
  if (!box) return;
  const gs = getGarments();
  if (!gs.length) { mount(box, emptyState({ title: "의상이 없습니다", ico: "empty" })); return; }
  mount(box, ...gs.map(g =>
    h("div", { class: "fit-thumb" + (picked.has(g.id) ? " is-sel" : ""), dataset: { g: g.id },
      title: `${g.name} — ${g.brand}`, onclick: () => toggle(g.id) },
      swatch(g, { square: true }),
      h("div", { class: "ft-check" }, icon("check", { size: 12 })))));
  updateCount();
}

function toggle(id) {
  if (picked.has(id)) picked.delete(id);
  else {
    if (picked.size >= MAX_GARMENTS) { toast(`의상은 최대 ${MAX_GARMENTS}개까지 선택할 수 있습니다.`, { type: "bad", title: "선택 제한" }); return; }
    picked.add(id);
  }
  document.querySelector(`.fit-thumb[data-g="${CSS.escape(id)}"]`)?.classList.toggle("is-sel", picked.has(id));
  updateCount();
}

function updateCount() {
  const c = document.getElementById("fit-count");
  if (c) c.textContent = picked.size ? `· ${picked.size}개 선택됨` : "";
}

/* ---------------- stages ---------------- */
function idleStage() {
  return h("div", { class: "fit-canvas" },
    h("div", { class: "state", style: { border: "0", background: "transparent", padding: "0" } },
      icon("layers", { size: 46, stroke: 1.2, cls: "state-ico" }),
      h("h3", null, "대상과 의상을 선택하세요"),
      h("p", { class: "muted" }, "선택 후 ‘트라이온 생성’을 누르면 실제 착장 이미지가 합성됩니다.")));
}

function loadingStage() {
  return h("div", { class: "fit-canvas" },
    h("div", { class: "fit-progress", style: { textAlign: "center" } },
      h("div", { class: "row", style: { justifyContent: "center", gap: "10px", color: "var(--ink-2)", fontWeight: "600" } },
        h("span", { class: "fit-spin" }),
        h("span", { id: "fit-status" }, "작업 생성 중…")),
      h("div", { class: "fit-bar" }, h("span", { id: "fit-bar-fill", style: { width: "6%" } })),
      h("div", { class: "muted", id: "fit-elapsed", style: { marginTop: "10px", fontSize: "12.5px", fontFamily: "var(--font-mono)" } }, "0초 경과"),
      h("div", { class: "muted", style: { marginTop: "4px", fontSize: "12px" } }, "보통 1분 정도 걸립니다. 잠시만 기다려 주세요.")));
}

function resultStage(imageUrl, garmentIds, { cacheHit = false } = {}) {
  const gs = getGarments();
  const chosen = garmentIds.map(id => gs.find(g => g.id === id)).filter(Boolean);
  const subjLabel = custom ? custom.label : (shortLabel(subjects.find(s => s.id === selSubjectId)?.label || selSubjectId || ""));

  return h("div", { style: { display: "flex", flexDirection: "column", height: "100%" } },
    h("div", { class: "fit-canvas" },
      h("img", { class: "fit-result-img", src: API_BASE + imageUrl, alt: "가상 트라이온 결과" })),
    h("div", { class: "panel-pad", style: { borderTop: "1px solid var(--line)" } },
      h("div", { class: "row wrap", style: { gap: "8px", marginBottom: "12px" } },
        h("span", { class: "pill ok" }, h("span", { class: "pdot" }), "생성 완료"),
        cacheHit ? h("span", { class: "pill neutral" }, h("span", { class: "pdot" }), "캐시됨") : null,
        h("span", { class: "pill neutral" }, h("span", { class: "pdot" }), subjLabel),
        ...chosen.map(g => h("span", { class: "chip" }, g.name))),
      h("div", { class: "row", style: { gap: "8px" } },
        h("button", { class: "btn btn-signal", onclick: generate }, icon("wand", { size: 15 }), "다시 생성"),
        h("a", { class: "btn btn-ghost", href: API_BASE + imageUrl, target: "_blank", rel: "noopener" },
          icon("arrowRight", { size: 15 }), "원본 보기"))));
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
  } else {
    payload.subject_id = selSubjectId;
  }

  const myRun = ++runSeq;
  const stage = document.getElementById("fit-stage");
  const btn = document.getElementById("fit-go");
  if (btn) btn.disabled = true;
  mount(stage, loadingStage());

  const startedAt = Date.now();
  let status = "queued";
  startTicker(() => ({ startedAt, status }));

  const done = (node, { ok = false } = {}) => {
    if (myRun !== runSeq) return;          // superseded by a newer render / view teardown
    stopTicker();
    if (btn) btn.disabled = false;
    mount(document.getElementById("fit-stage"), node);
    if (ok) toast("가상 트라이온 생성 완료", { type: "ok" });
  };

  try {
    const created = await api.fitRender(payload);
    if (myRun !== runSeq) return;
    status = created.status || "queued";

    // cache hit (or instant done): result is ready immediately
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
      try {
        job = await api.fitJob(jobId, { quiet: true });
        transientErrors = 0;
      } catch (e) {
        if (++transientErrors >= 5) throw e;   // tolerate brief network blips
        continue;
      }
      if (myRun !== runSeq) return;
      status = job.status;
      if (status === "done") {
        if (job.result_image_url) done(resultStage(job.result_image_url, garmentIds, { cacheHit: job.cache_hit }), { ok: true });
        else done(failedStage("렌더 결과 이미지가 아직 준비되지 않았습니다."), { ok: false });
        return;
      }
      if (status === "failed") {
        done(failedStage(cleanError(job.error)), { ok: false });
        toast("이미지 합성을 완료하지 못했습니다.", { type: "bad", title: "ON Fit" });
        return;
      }
    }
    done(failedStage("렌더 시간이 초과되었습니다. 잠시 후 다시 시도하세요."), { ok: false });
  } catch (err) {
    done(failedStage(cleanError(err?.message)), { ok: false });
  }
}

/* 백엔드 raw 스택 트레이스/긴 에러를 사용자용 한 줄 메시지로 정돈 */
function cleanError(raw) {
  const s = (raw || "").toString().trim();
  if (!s) return "이미지 합성에 실패했습니다.";
  // node/sharp 스택 트레이스 등 기술적 노이즈는 숨기고 친화적 안내로 대체
  if (/\bat\s|node:internal|node_modules|loader:|Module\.|Error:/.test(s) || s.length > 140) {
    return "이미지 합성 워커가 응답하지 않았습니다. 가상 트라이온 렌더는 준비 중이며, 흐름(요청 → 폴링 → 결과 슬롯)은 정상 동작합니다.";
  }
  return s;
}

/* 실패 상태 — 다크 스테이지 톤에 맞춘 깔끔한 빈/오류 슬롯 */
function failedStage(message) {
  return h("div", { class: "fit-canvas" },
    h("div", { class: "state", style: { border: "0", background: "transparent", padding: "0", maxWidth: "360px" } },
      icon("alert", { size: 46, stroke: 1.3, cls: "state-ico" }),
      h("h3", null, "결과를 생성하지 못했습니다"),
      h("p", { class: "muted" }, message),
      h("button", { class: "btn btn-signal", style: { marginTop: "14px" }, onclick: generate },
        icon("refresh", { size: 15 }), "다시 시도")));
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
    if (label) label.textContent = status === "running" ? "합성 렌더링 중…"
      : status === "queued" ? "대기열 등록됨…" : "이미지 수신 중…";
    if (fill) {
      // ease toward ~94% over ~72s so the bar feels alive during the ~60s render
      const pct = Math.min(94, 6 + (sec / 72) * 88);
      fill.style.width = pct.toFixed(1) + "%";
    }
  };
  update();
  ticker = setInterval(update, 1000);
}
function stopTicker() { if (ticker) { clearInterval(ticker); ticker = null; } }

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
