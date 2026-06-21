// Thin typed-ish client over the real STYLE:ON FastAPI backend.
import { API_BASE } from "./config.js";
import { getRole } from "./store.js";

// A few subscribers (the top progress bar, health dot) listen to request flow.
let inflight = 0;
const listeners = new Set();
export function onNetwork(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { for (const fn of listeners) fn(inflight); }

export class ApiError extends Error {
  constructor(message, { status, detail, body } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;   // parsed `detail` from FastAPI (string | object | array)
    this.body = body;
  }
}

function describeDetail(detail, fallback) {
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    // FastAPI 422 validation list
    return detail.map(d => {
      const loc = Array.isArray(d.loc) ? d.loc.filter(x => x !== "body").join(".") : "";
      return loc ? `${loc}: ${d.msg}` : d.msg;
    }).join(" · ");
  }
  if (typeof detail === "object") return detail.message || fallback;
  return fallback;
}

async function request(method, path, { body, role, signal, quiet } = {}) {
  const headers = { "X-Role": role || getRole() };
  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  // `quiet` requests (e.g. the ON Fit job poll loop) skip the global progress
  // bar so a long ~60s poll doesn't flash the top loader every couple seconds.
  if (!quiet) { inflight++; emit(); }
  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: payload, signal });
  } catch (err) {
    if (!quiet) { inflight = Math.max(0, inflight - 1); emit(); }
    if (err.name === "AbortError") throw err;
    throw new ApiError("백엔드에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.", { status: 0 });
  }
  if (!quiet) { inflight = Math.max(0, inflight - 1); emit(); }

  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }

  if (!res.ok) {
    const detail = data && typeof data === "object" ? data.detail : data;
    throw new ApiError(describeDetail(detail, `요청 실패 (HTTP ${res.status})`), {
      status: res.status, detail, body: data,
    });
  }
  return data;
}

function crewQuery(q, page, per_page) {
  const params = new URLSearchParams({ page, per_page });
  const term = (q || "").trim();
  if (term) params.set("q", term);
  return params.toString();
}

export const api = {
  health: (opts) => request("GET", "/api/health", opts),

  sourcingSearch: (payload, opts) =>
    request("POST", "/api/sourcing/search", { body: payload, ...opts }),

  sponsorCheck: (payload, opts) =>
    request("POST", "/api/sponsor/check", { body: payload, ...opts }),

  sponsorRequest: (payload, opts) =>
    request("POST", "/api/sponsor/request", { body: payload, ...opts }),

  trackRequests: ({ status, page = 1, per_page = 50 } = {}, opts) => {
    const q = new URLSearchParams({ page, per_page });
    if (status) q.set("status", status);
    return request("GET", `/api/track/requests?${q}`, opts);
  },

  transition: (id, payload, opts) =>
    request("POST", `/api/track/requests/${encodeURIComponent(id)}/transition`, { body: payload, ...opts }),

  conflicts: ({ page = 1, per_page = 50 } = {}, opts) =>
    request("GET", `/api/track/conflicts?page=${page}&per_page=${per_page}`, opts),

  // ON Fit — virtual try-on (live async-job contract).
  // GET  /api/fit/subjects        -> { subjects: [{ id, label, image_url }] }
  // POST /api/fit/render          -> 202 { job_id, status, status_url, cache_hit, result_image_url? }
  // GET  /api/fit/jobs/{job_id}   -> { id, status, result_image_url, error, ... }
  fitSubjects: (opts) => request("GET", "/api/fit/subjects", opts),
  fitRender: (payload, opts) => request("POST", "/api/fit/render", { body: payload, ...opts }),
  fitJob: (id, opts) => request("GET", `/api/fit/jobs/${encodeURIComponent(id)}`, opts),

  // ON Ref — mood/concept reference search -> ranked reference images + garments.
  refSearch: (payload, opts) =>
    request("POST", "/api/ref/search", { body: payload, ...opts }),

  // ON Lens — visual identify -> best guess + similar catalog items.
  lensIdentify: (payload, opts) =>
    request("POST", "/api/lens/identify", { body: payload, ...opts }),

  // ON Trend — current ranking + 4-week forecast.
  trendBrief: ({ page = 1, per_page = 20 } = {}, opts) =>
    request("GET", `/api/trend/brief?page=${page}&per_page=${per_page}`, opts),

  // ON Pay — receipt parsing + CSV export.
  payReceipt: (payload, opts) =>
    request("POST", "/api/pay/receipt", { body: payload, ...opts }),
  payExportUrl: () => API_BASE + "/api/pay/export",

  // ON Desk — schedule / return-date events with D-day.
  deskEvents: ({ owner_stylist_id, page = 1, per_page = 100 } = {}, opts) => {
    const q = new URLSearchParams({ page, per_page });
    if (owner_stylist_id) q.set("owner_stylist_id", owner_stylist_id);
    return request("GET", `/api/desk/events?${q}`, opts);
  },
  deskCreate: (payload, opts) =>
    request("POST", "/api/desk/events", { body: payload, ...opts }),
  deskDelete: (eventId, opts) =>
    request("DELETE", `/api/desk/events/${encodeURIComponent(eventId)}`, opts),

  // ON Crew — agencies / contacts / lookbooks / jobs / knowhow (role-gated PII).
  crewAgencies: ({ q, page = 1, per_page = 50 } = {}, opts) =>
    request("GET", `/api/crew/agencies?${crewQuery(q, page, per_page)}`, opts),
  crewContacts: ({ q, page = 1, per_page = 50 } = {}, opts) =>
    request("GET", `/api/crew/contacts?${crewQuery(q, page, per_page)}`, opts),
  crewLookbooks: ({ q, page = 1, per_page = 50 } = {}, opts) =>
    request("GET", `/api/crew/lookbooks?${crewQuery(q, page, per_page)}`, opts),
  crewJobs: ({ q, page = 1, per_page = 50 } = {}, opts) =>
    request("GET", `/api/crew/jobs?${crewQuery(q, page, per_page)}`, opts),
  crewKnowhow: ({ q, page = 1, per_page = 50 } = {}, opts) =>
    request("GET", `/api/crew/knowhow?${crewQuery(q, page, per_page)}`, opts),

  // Probe a not-yet-deployed endpoint without throwing.
  probe: async (path) => {
    try {
      const res = await fetch(API_BASE + path, { method: "GET", headers: { "X-Role": getRole() } });
      return res.status;
    } catch { return 0; }
  },
};
