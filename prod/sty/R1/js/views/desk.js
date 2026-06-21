// ON Desk — shoot schedule & return-date desk wired to the LIVE backend:
// GET/POST/DELETE /api/desk/events. (Re:Connect 룩)
import { h, icon, mount, ddayBadge, skeletonGrid, emptyState, errorState } from "../ui.js";
import { api, ApiError } from "../api.js";
import { modal, toast } from "../overlay.js";
import { getRole } from "../store.js";
import { viewHead, sectionLabel } from "./sponsor.js";

const canDelete = () => getRole() === "admin" || getRole() === "stylist";

const PREP = {
  planned: { ko: "예정", cls: "neutral" },
  pulling: { ko: "풀링 중", cls: "warn" },
  ready: { ko: "준비 완료", cls: "info" },
  done: { ko: "완료", cls: "ok" },
};
const prepMeta = (s) => PREP[s] || { ko: s, cls: "neutral" };

let ownerFilter = "";

export default {
  async render(root) { mount(root, shell()); load(); return () => {}; },
};

function shell() {
  const ownerInput = h("input", { type: "text", id: "desk-owner", class: "control !py-2 !text-[13px]",
    style: { width: "auto", minWidth: "180px" }, placeholder: "담당 스타일리스트 ID 필터", value: ownerFilter });
  ownerInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { ownerFilter = ownerInput.value.trim(); load(); } });

  return h("div", null,
    viewHead("ON DESK · 09", "촬영", "스케줄과 반납 D-day",
      "촬영 일정과 협찬 반납일을 한 데스크에서 관리합니다. 임박한 준비·반납은 D-day 알림으로 표시됩니다."),
    h("div", { class: "flex flex-wrap items-center justify-between gap-3 mb-5" },
      h("div", { class: "flex items-center gap-2.5" },
        ownerInput,
        h("button", { class: "btn btn-ghost btn-sm", onclick: () => { ownerFilter = ownerInput.value.trim(); load(); } }, "필터"),
        ownerFilter ? h("button", { class: "btn btn-ghost btn-sm", onclick: () => { ownerFilter = ""; load(); } }, "초기화") : null),
      h("div", { class: "flex items-center gap-2.5" },
        h("button", { class: "btn btn-ghost btn-sm", onclick: load }, icon("refresh", { size: 14 }), "새로고침"),
        h("button", { class: "btn btn-signal btn-sm", onclick: openCreate }, icon("spark", { size: 14 }), "이벤트 생성"))),
    h("div", { id: "desk-body" }));
}

async function load() {
  const body = document.getElementById("desk-body");
  if (!body) return;
  mount(body, h("div", { class: "mt-2" }, skeletonGrid(3)));
  try {
    const res = await api.deskEvents({ owner_stylist_id: ownerFilter || undefined, per_page: 100 });
    mount(body, content(res));
  } catch (err) { mount(body, errorState(err, load)); }
}

function content(res) {
  const events = res.results || [];
  const alerts = res.track_return_alerts || [];

  const eventsBlock = events.length
    ? h("div", { class: "grid md:grid-cols-2 xl:grid-cols-3 gap-5" }, ...events.map(eventCard))
    : emptyState({ title: "등록된 이벤트가 없습니다",
        body: ownerFilter ? "이 담당자의 이벤트가 없습니다. 필터를 초기화해 보세요." : "‘이벤트 생성’으로 첫 촬영 일정을 추가해 보세요.", ico: "calendar" });

  return h("div", null,
    h("div", { class: "text-sm text-slate-500 mb-4" }, "촬영 이벤트 ", h("b", { class: "text-slate-800" }, String(res.total ?? events.length)), "건"),
    eventsBlock,
    h("div", { class: "mt-9 mb-4" }, sectionLabel("ON Track 반납 알림")),
    alerts.length
      ? h("div", { class: "grid sm:grid-cols-2 lg:grid-cols-3 gap-4" }, ...alerts.map(alertCard))
      : emptyState({ title: "임박한 반납이 없습니다", ico: "checkCircle" }));
}

function eventCard(e) {
  const pm = prepMeta(e.prep_status);
  const alert = e.prep_alert || e.return_alert;
  return h("article", { class: "rounded-3xl border bg-white shadow-card p-5 flex flex-col gap-3 " + (alert ? "border-amber-200" : "border-slate-100") },
    h("div", { class: "flex items-start justify-between gap-3" },
      h("div", { class: "min-w-0" },
        h("h3", { class: "font-extrabold tracking-tight text-slate-800 truncate" }, e.title),
        h("div", { class: "flex items-center gap-1.5 text-[12.5px] text-slate-500 mt-0.5" }, icon("pin", { size: 13, cls: "text-brand-400" }), e.location)),
      h("div", { class: "flex items-center gap-2 shrink-0" },
        h("span", { class: `pill ${pm.cls}` }, h("span", { class: "pdot" }), pm.ko),
        canDelete() ? h("button", { class: "w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center transition-colors",
          title: "이벤트 삭제", "aria-label": `이벤트 삭제: ${e.title}`, onclick: () => confirmDelete(e) }, icon("x", { size: 14 })) : null)),
    h("div", { class: "grid grid-cols-2 gap-2.5" },
      dateBox("촬영", e.shoot_date, ddayBadge(e.shoot_d_day)),
      dateBox("반납", e.return_date || "—", e.return_date ? ddayBadge(e.return_d_day) : h("span", { class: "dday calm" }, "미정"))),
    e.notes ? h("div", { class: "text-[12.5px] text-slate-500 leading-snug" }, e.notes) : null,
    h("div", { class: "mono text-[11px] text-slate-400 flex flex-wrap gap-x-2" },
      h("span", null, "담당 ", e.owner_stylist_id),
      e.sponsorship_request_id ? h("span", null, "· 협찬 ", e.sponsorship_request_id) : null),
    alert ? h("div", { class: "flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 text-[12.5px] font-semibold text-amber-700" },
      icon("alert", { size: 14 }), e.prep_alert ? "준비 임박 — 풀링 마감 확인" : "반납 임박 — 일정 확인") : null);
}
function dateBox(label, value, badge) {
  return h("div", { class: "rounded-2xl bg-slate-50 p-3" },
    h("div", { class: "mono text-[10px] font-bold uppercase text-slate-400" }, label),
    h("div", { class: "mono text-[13px] font-semibold text-slate-700 my-1" }, value),
    badge);
}

function alertCard(a) {
  return h("article", { class: "rounded-2xl border bg-white shadow-card p-4 flex flex-col gap-2 " + (a.alert ? "border-rose-200" : "border-slate-100") },
    h("div", { class: "flex items-center justify-between gap-2" },
      h("span", { class: "mono text-[13px] font-bold text-slate-700 truncate" }, a.garment_id),
      ddayBadge(a.return_d_day)),
    h("div", { class: "mono text-[12px] text-slate-400" }, "반납 ", a.return_date, " · 요청자 ", a.requester_stylist_id),
    h("a", { class: "mono text-[12.5px] font-semibold text-brand-600 hover:underline", href: "#/track" }, a.sponsorship_request_id, " →"));
}

/* ---------- delete ---------- */
function confirmDelete(e) {
  const body = h("div", { class: "flex flex-col gap-2" },
    h("p", { class: "text-slate-700" }, h("b", null, e.title), " 이벤트를 삭제할까요?"),
    h("p", { class: "mono text-[13px] text-slate-400" }, `${e.shoot_date} · ${e.location} · ${e.event_id}`),
    h("p", { class: "text-[13px] text-slate-500" }, "이 작업은 되돌릴 수 없습니다."));
  const delBtn = h("button", { class: "btn btn-danger", type: "button" }, icon("x", { size: 16 }), "삭제");
  const ctl = modal({
    title: "이벤트 삭제", sub: "DELETE /api/desk/events/{event_id}", body,
    footer: [h("button", { class: "btn btn-ghost", type: "button", onclick: () => ctl.close() }, "취소"), delBtn],
  });
  delBtn.onclick = async () => {
    delBtn.disabled = true; delBtn.replaceChildren(h("span", { class: "spin on-dark" }), "삭제 중…");
    try {
      await api.deskDelete(e.event_id);
      ctl.close();
      toast(`이벤트 삭제됨 · ${e.title}`, { type: "ok", title: "ON Desk" });
      load();
    } catch (err) {
      delBtn.disabled = false; delBtn.replaceChildren(icon("x", { size: 16 }), "삭제");
      toast(err instanceof ApiError ? err.message : "이벤트 삭제 실패", { type: "bad", title: "삭제 실패" });
    }
  };
}

/* ---------- create ---------- */
function openCreate() {
  const title = h("input", { type: "text", id: "de-title", class: "control", required: true, placeholder: "예: Han Minseo 화보 피팅", maxlength: 200 });
  const shoot = h("input", { type: "date", id: "de-shoot", class: "control", required: true });
  const ret = h("input", { type: "date", id: "de-return", class: "control" });
  const loc = h("input", { type: "text", id: "de-loc", class: "control", required: true, placeholder: "예: Gangnam Studio A", maxlength: 200 });
  const owner = h("input", { type: "text", id: "de-owner", class: "control", required: true, value: "stylist-001", maxlength: 120 });
  const prep = h("select", { id: "de-prep" }, ...Object.entries(PREP).map(([k, v]) => h("option", { value: k, selected: k === "planned" }, `${v.ko} (${k})`)));
  const notes = h("textarea", { id: "de-notes", class: "control", rows: 2, placeholder: "준비 메모 (선택)", maxlength: 1000 }, "");

  const body = h("form", { id: "de-form", onsubmit: (e) => { e.preventDefault(); submit(); }, class: "flex flex-col gap-4" },
    h("div", { class: "field" }, h("label", { for: "de-title" }, "제목"), title),
    h("div", { class: "grid grid-cols-1 sm:grid-cols-2 gap-3" },
      h("div", { class: "field" }, h("label", { for: "de-shoot" }, "촬영일"), shoot),
      h("div", { class: "field" }, h("label", { for: "de-return" }, "반납일 (선택)"), ret)),
    h("div", { class: "field" }, h("label", { for: "de-loc" }, "장소"), loc),
    h("div", { class: "grid grid-cols-1 sm:grid-cols-2 gap-3" },
      h("div", { class: "field" }, h("label", { for: "de-owner" }, "담당 스타일리스트 ID"), owner),
      h("div", { class: "field" }, h("label", { for: "de-prep" }, "준비 상태"), prep)),
    h("div", { class: "field" }, h("label", { for: "de-notes" }, "메모"), notes));

  const submitBtn = h("button", { class: "btn btn-signal", type: "submit", form: "de-form" }, icon("checkCircle", { size: 16 }), "이벤트 생성");
  const ctl = modal({
    title: "촬영 이벤트 생성", sub: "POST /api/desk/events", body,
    footer: [h("button", { class: "btn btn-ghost", type: "button", onclick: () => ctl.close() }, "취소"), submitBtn],
  });

  async function submit() {
    const payload = {
      title: title.value.trim(), shoot_date: shoot.value, location: loc.value.trim(),
      owner_stylist_id: owner.value.trim(), prep_status: prep.value, notes: notes.value.trim(),
    };
    if (ret.value) payload.return_date = ret.value;
    if (!payload.title || !payload.shoot_date || !payload.location || !payload.owner_stylist_id) {
      toast("제목 · 촬영일 · 장소 · 담당자 ID는 필수입니다.", { type: "bad", title: "입력 확인" }); return;
    }
    submitBtn.disabled = true; submitBtn.replaceChildren(h("span", { class: "spin on-dark" }), "생성 중…");
    try {
      const out = await api.deskCreate(payload);
      ctl.close();
      toast(`이벤트 ${out.event_id} 생성됨 · ${out.title}`, { type: "ok", title: "ON Desk" });
      load();
    } catch (err) {
      submitBtn.disabled = false; submitBtn.replaceChildren(icon("checkCircle", { size: 16 }), "이벤트 생성");
      toast(err instanceof ApiError ? err.message : "이벤트 생성 실패", { type: "bad", title: "생성 실패" });
    }
  }
}
