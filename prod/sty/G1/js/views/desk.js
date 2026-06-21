// ON Desk — shoot schedule & return-date desk wired to the LIVE backend:
// GET /api/desk/events (events + track_return_alerts) and POST /api/desk/events.
import { h, icon, mount, chip, ddayBadge, skeletonGrid, emptyState, errorState } from "../ui.js";
import { api, ApiError } from "../api.js";
import { modal, toast } from "../overlay.js";
import { getRole } from "../store.js";

// Removing a desk event is an operator action — admins manage the platform and
// stylists own their desk; showroom partners are read-only. The server enforces
// this too (403), but we hide the affordance to match.
const canDelete = () => getRole() === "admin" || getRole() === "stylist";

const PREP = {
  planned: { ko: "예정",   cls: "neutral" },
  pulling: { ko: "풀링 중", cls: "warn" },
  ready:   { ko: "준비 완료", cls: "info" },
  done:    { ko: "완료",   cls: "ok" },
};
const prepMeta = (s) => PREP[s] || { ko: s, cls: "neutral" };

let ownerFilter = "";

export default {
  async render(root) {
    mount(root, shell());
    load();
    return () => {};
  },
};

function shell() {
  const ownerInput = h("input", { type: "text", id: "desk-owner", class: "control",
    style: { width: "auto", minWidth: "180px" }, placeholder: "담당 스타일리스트 ID 필터", value: ownerFilter });
  ownerInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { ownerFilter = ownerInput.value.trim(); load(); } });

  return h("section", { class: "view" },
    h("header", { class: "view-head" },
      h("div", { class: "eyebrow" }, "ON DESK · 09"),
      h("h1", { class: "view-title" }, "촬영 ", h("em", null, "스케줄"), "과 반납 D-day"),
      h("p", { class: "view-lede" }, "촬영 일정과 협찬 반납일을 한 데스크에서 관리합니다. 임박한 준비·반납은 D-day 알림으로 표시됩니다.")),
    h("div", { class: "track-toolbar" },
      h("div", { class: "row", style: { gap: "10px" } },
        ownerInput,
        h("button", { class: "btn btn-ghost btn-sm", onclick: () => { ownerFilter = ownerInput.value.trim(); load(); } }, "필터"),
        ownerFilter ? h("button", { class: "btn btn-ghost btn-sm", onclick: () => { ownerFilter = ""; load(); } }, "초기화") : null),
      h("div", { class: "row", style: { gap: "10px" } },
        h("button", { class: "btn btn-ghost btn-sm", onclick: load }, icon("refresh", { size: 14 }), "새로고침"),
        h("button", { class: "btn btn-signal btn-sm", onclick: openCreate }, icon("spark", { size: 14 }), "이벤트 생성"))),
    h("div", { id: "desk-body" }));
}

async function load() {
  const body = document.getElementById("desk-body");
  if (!body) return;
  mount(body, h("div", { style: { marginTop: "6px" } }, skeletonGrid(3)));
  try {
    const res = await api.deskEvents({ owner_stylist_id: ownerFilter || undefined, per_page: 100 });
    mount(body, content(res));
  } catch (err) {
    mount(body, errorState(err, load));
  }
}

function content(res) {
  const events = res.results || [];
  const alerts = res.track_return_alerts || [];

  const eventsBlock = events.length
    ? h("div", { class: "desk-grid" }, ...events.map(eventCard))
    : emptyState({ title: "등록된 이벤트가 없습니다",
        body: ownerFilter ? "이 담당자의 이벤트가 없습니다. 필터를 초기화해 보세요." : "‘이벤트 생성’으로 첫 촬영 일정을 추가해 보세요.",
        ico: "layers" });

  return h("div", null,
    h("div", { class: "results-meta" },
      h("div", { class: "count" }, "촬영 이벤트 ", h("b", null, String(res.total ?? events.length)), "건")),
    eventsBlock,
    h("div", { class: "section-label", style: { marginTop: "34px" } }, "ON Track 반납 알림"),
    alerts.length
      ? h("div", { class: "alert-grid" }, ...alerts.map(alertCard))
      : emptyState({ title: "임박한 반납이 없습니다", ico: "checkCircle" }));
}

function eventCard(e) {
  const pm = prepMeta(e.prep_status);
  return h("article", { class: "desk-card" + (e.prep_alert || e.return_alert ? " is-alert" : "") },
    h("div", { class: "desk-card-head" },
      h("div", null,
        h("h3", { class: "desk-title" }, e.title),
        h("div", { class: "desk-loc muted" }, icon("pin", { size: 13 }), " ", e.location)),
      h("div", { class: "row", style: { gap: "8px", alignItems: "center" } },
        h("span", { class: `pill ${pm.cls}` }, h("span", { class: "pdot" }), pm.ko),
        canDelete()
          ? h("button", { class: "btn btn-ghost btn-sm desk-del", title: "이벤트 삭제",
              "aria-label": `이벤트 삭제: ${e.title}`, onclick: () => confirmDelete(e) },
              icon("x", { size: 14 }))
          : null)),
    h("div", { class: "desk-dates" },
      h("div", { class: "desk-date" },
        h("span", { class: "desk-date-lbl mono" }, "촬영"),
        h("span", { class: "desk-date-val mono" }, e.shoot_date),
        ddayBadge(e.shoot_d_day)),
      h("div", { class: "desk-date" },
        h("span", { class: "desk-date-lbl mono" }, "반납"),
        h("span", { class: "desk-date-val mono" }, e.return_date || "—"),
        e.return_date ? ddayBadge(e.return_d_day) : h("span", { class: "dday calm" }, "미정"))),
    e.notes ? h("div", { class: "desk-notes muted" }, e.notes) : null,
    h("div", { class: "desk-meta mono muted" },
      h("span", null, "담당 ", e.owner_stylist_id),
      e.sponsorship_request_id ? h("span", null, " · 협찬 ", e.sponsorship_request_id) : null),
    (e.prep_alert || e.return_alert) ? h("div", { class: "desk-alert-line" },
      icon("alert", { size: 14 }),
      h("span", null, e.prep_alert ? "준비 임박 — 풀링 마감 확인" : "반납 임박 — 일정 확인")) : null);
}

function alertCard(a) {
  return h("article", { class: "alert-card" + (a.alert ? " hot" : "") },
    h("div", { class: "row", style: { justifyContent: "space-between", gap: "8px" } },
      h("span", { class: "alert-garment mono" }, a.garment_id),
      ddayBadge(a.return_d_day)),
    h("div", { class: "alert-meta mono muted" }, "반납 ", a.return_date, " · 요청자 ", a.requester_stylist_id),
    h("a", { class: "alert-link mono", href: "#/track" }, a.sponsorship_request_id, " →"));
}

/* ---------- delete event ---------- */
function confirmDelete(e) {
  const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } },
    h("p", null, h("b", null, e.title), " 이벤트를 삭제할까요?"),
    h("p", { class: "muted mono", style: { fontSize: "13px" } },
      `${e.shoot_date} · ${e.location} · ${e.event_id}`),
    h("p", { class: "muted", style: { fontSize: "13px" } }, "이 작업은 되돌릴 수 없습니다."));

  const delBtn = h("button", { class: "btn btn-danger", type: "button" },
    icon("x", { size: 16 }), "삭제");

  const ctl = modal({
    title: "이벤트 삭제",
    sub: "DELETE /api/desk/events/{event_id}",
    body,
    footer: [
      h("button", { class: "btn btn-ghost", type: "button", onclick: () => ctl.close() }, "취소"),
      delBtn,
    ],
  });

  delBtn.onclick = async () => {
    delBtn.disabled = true;
    delBtn.replaceChildren(h("span", { class: "spin" }), "삭제 중…");
    try {
      await api.deskDelete(e.event_id);
      ctl.close();
      toast(`이벤트 삭제됨 · ${e.title}`, { type: "ok", title: "ON Desk" });
      load();
    } catch (err) {
      delBtn.disabled = false;
      delBtn.replaceChildren(icon("x", { size: 16 }), "삭제");
      const msg = err instanceof ApiError ? err.message : "이벤트 삭제 실패";
      toast(msg, { type: "bad", title: "삭제 실패" });
    }
  };
}

/* ---------- create event ---------- */
function openCreate() {
  const title = h("input", { type: "text", id: "de-title", class: "control", required: true, placeholder: "예: Han Minseo 화보 피팅", maxlength: 200 });
  const shoot = h("input", { type: "date", id: "de-shoot", class: "control", required: true });
  const ret = h("input", { type: "date", id: "de-return", class: "control" });
  const loc = h("input", { type: "text", id: "de-loc", class: "control", required: true, placeholder: "예: Gangnam Studio A", maxlength: 200 });
  const owner = h("input", { type: "text", id: "de-owner", class: "control", required: true, value: "stylist-001", maxlength: 120 });
  const prep = h("select", { id: "de-prep" },
    ...Object.entries(PREP).map(([k, v]) => h("option", { value: k, selected: k === "planned" }, `${v.ko} (${k})`)));
  const notes = h("textarea", { id: "de-notes", class: "control", placeholder: "준비 메모 (선택)", maxlength: 1000 }, "");

  const body = h("form", { id: "de-form", onsubmit: (e) => { e.preventDefault(); submit(); },
    style: { display: "flex", flexDirection: "column", gap: "16px" } },
    h("div", { class: "field" }, h("label", { for: "de-title" }, "제목"), title),
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { for: "de-shoot" }, "촬영일"), shoot),
      h("div", { class: "field" }, h("label", { for: "de-return" }, "반납일 (선택)"), ret)),
    h("div", { class: "field" }, h("label", { for: "de-loc" }, "장소"), loc),
    h("div", { class: "form-grid" },
      h("div", { class: "field" }, h("label", { for: "de-owner" }, "담당 스타일리스트 ID"), owner),
      h("div", { class: "field" }, h("label", { for: "de-prep" }, "준비 상태"), prep)),
    h("div", { class: "field" }, h("label", { for: "de-notes" }, "메모"), notes));

  const submitBtn = h("button", { class: "btn btn-signal", type: "submit", form: "de-form" },
    icon("checkCircle", { size: 16 }), "이벤트 생성");

  const ctl = modal({
    title: "촬영 이벤트 생성",
    sub: "ON Desk 데스크에 새 일정을 추가합니다 · POST /api/desk/events",
    body,
    footer: [
      h("button", { class: "btn btn-ghost", type: "button", onclick: () => ctl.close() }, "취소"),
      submitBtn,
    ],
  });

  async function submit() {
    const payload = {
      title: title.value.trim(),
      shoot_date: shoot.value,
      location: loc.value.trim(),
      owner_stylist_id: owner.value.trim(),
      prep_status: prep.value,
      notes: notes.value.trim(),
    };
    if (ret.value) payload.return_date = ret.value;
    if (!payload.title || !payload.shoot_date || !payload.location || !payload.owner_stylist_id) {
      toast("제목 · 촬영일 · 장소 · 담당자 ID는 필수입니다.", { type: "bad", title: "입력 확인" });
      return;
    }
    submitBtn.disabled = true;
    submitBtn.replaceChildren(h("span", { class: "spin" }), "생성 중…");
    try {
      const out = await api.deskCreate(payload);
      ctl.close();
      toast(`이벤트 ${out.event_id} 생성됨 · ${out.title}`, { type: "ok", title: "ON Desk" });
      load();
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.replaceChildren(icon("checkCircle", { size: 16 }), "이벤트 생성");
      const msg = err instanceof ApiError ? err.message : "이벤트 생성 실패";
      toast(msg, { type: "bad", title: "생성 실패" });
    }
  }
}
