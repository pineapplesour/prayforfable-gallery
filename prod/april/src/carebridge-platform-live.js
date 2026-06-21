/*
 * 랄피 / CareBridge platform — live wiring for the april/platform backend.
 * Preserves the approved carebridge visual design and binds every feature to the
 * real FastAPI backend (same-origin proxy: /v1/*, /health -> http://127.0.0.1:8780).
 *
 * Features wired: auth (signup/login/me), 마음 체크인 (deterministic turn-by-turn),
 * AI 상담 채팅 (memory-grounded, 기억 indicator), 상담사 찾기 + 매칭, 커뮤니티
 * (rooms/posts/comments/like), 상담 신청 (booking + status transition).
 *
 * Conversation, comment, and booking list endpoints are now backed by the API;
 * localStorage only keeps lightweight client-side UI state.
 */

const LS = {
  auth: 'april.auth.v1',
  convs: 'april.conversations.v1',
  bookings: 'april.bookings.v1',
  adminCounselors: 'april.adminCounselors.v1',
};

const state = {
  view: 'home',
  auth: loadJSON(LS.auth, null), // { token, account, profile }
  authMode: 'login',
  mobileNavOpen: false,
  chat: { open: false, expanded: false, mode: 'checkin', pending: false, status: 'idle' },
  checkin: { sessionId: null, messages: [], chips: [], stage: null, result: null, starting: false },
  ai: { conversationId: null, title: '', messages: [], pending: false },
  conversations: loadJSON(LS.convs, []), // [{id,title,preview,updatedAt}]
  bookings: loadJSON(LS.bookings, []),   // [{...booking}]
  counselors: [],
  filters: { specialty: '', approach: '', region: '', availability: '', q: '' },
  matches: [],          // [{counselor, score, reasons}]
  matchActive: false,
  rooms: [],
  activeRoom: 'all',
  posts: [],
  comments: {},         // postId -> [comment] (session-local, GET list unavailable)
  postsLoaded: false,
  counselorsLoaded: false,
  modal: null,          // 'auth'|'booking'|'post'|'post-detail'|'bookings'|'counselor-form'|'counselor-detail'|'record-form'|'record-detail'
  bookingCounselor: null,
  activePost: null,
  // Admin-touched counselors are cached so non-active (pending/inactive) ones the
  // public/admin list endpoint hides remain manageable within the session.
  adminCounselors: loadJSON(LS.adminCounselors, []),
  adminCounselorQuery: '',
  adminCounselorStatus: '',
  editingCounselorId: null,
  documents: [],
  documentsFilter: { counselorId: '', clientRef: '', type: '' },
  documentsLoaded: false,
  records: [],
  recordsFilter: { counselorId: '', clientRef: '', status: '', date: '' },
  recordsLoaded: false,
  activeRecord: null,
};

function role() { return state.auth?.account?.role || (state.auth?.token ? 'user' : 'guest'); }
function isAdmin() { return role() === 'admin'; }
function canManageDocs() { return role() === 'admin' || role() === 'counselor'; }

/* ------------------------------------------------------------------ utils */
function loadJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function $(sel, root = document) { return root.querySelector(sel); }
function $bind(name, root = document) { return root.querySelector(`[data-bind="${name}"]`); }
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(s) { return escapeHtml(s).replace(/`/g, '&#96;'); }

function renderMarkdown(text) {
  const esc = escapeHtml(text);
  const lines = esc.split('\n');
  let html = '';
  let inList = false;
  for (let raw of lines) {
    let line = raw;
    const isLi = /^\s*([-*•]|\d+\.)\s+/.test(line);
    if (isLi) {
      if (!inList) { html += '<ul class="list-disc pl-5 space-y-1 my-2">'; inList = true; }
      line = line.replace(/^\s*([-*•]|\d+\.)\s+/, '');
      html += `<li>${inline(line)}</li>`;
      continue;
    }
    if (inList) { html += '</ul>'; inList = false; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { html += `<h4 class="font-bold text-gray-900 mt-3 mb-1">${inline(h[2])}</h4>`; continue; }
    if (line.trim() === '') { html += '<div class="h-2"></div>'; continue; }
    html += `<p>${inline(line)}</p>`;
  }
  if (inList) html += '</ul>';
  return html;
  function inline(s) {
    return s
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-900">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded text-primary">$1</code>');
  }
}

let toastTimer = 0;
function toast(message) {
  const el = $bind('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.add('hidden'), 3200);
}

/* -------------------------------------------------------------------- api */
async function api(path, opts = {}) {
  const headers = { 'content-type': 'application/json' };
  if (opts.auth !== false && state.auth?.token) headers.Authorization = `Bearer ${state.auth.token}`;
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  const txt = await res.text();
  let data = {};
  try { data = txt ? JSON.parse(txt) : {}; } catch { data = { raw: txt }; }
  if (!res.ok) {
    const msg = data?.error?.message || data?.detail || `요청 실패 (${res.status})`;
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

/* -------------------------------------------------------------------- boot */
function boot() {
  document.addEventListener('click', onClick, false);
  document.addEventListener('keydown', onKeydown, false);
  document.addEventListener('input', onInput, false);
  document.addEventListener('change', onInput, false);
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  renderMobileNav();
  renderAuthArea();
  renderRoleUI();
  renderHomeSearchOptions();
  renderFilterControls();
  renderViewPanels();
  renderChatShell();
  // Warm up shared data so navigation feels instant.
  loadCounselors().catch(() => {});
  loadCommunity().catch(() => {});
  if (state.auth?.token) refreshMe();
}

// Lightweight input/change routing for filter selects + admin search controls.
function onInput(e) {
  const t = e.target;
  if (!t || !t.getAttribute) return;
  const input = t.getAttribute('data-input');
  if (input === 'admin-counselor-q') { state.adminCounselorQuery = t.value || ''; renderAdminCounselors(); }
  else if (input === 'admin-counselor-status') { state.adminCounselorStatus = t.value || ''; renderAdminCounselors(); }
  else if (input === 'doc-filter-type') { state.documentsFilter.type = t.value || ''; loadDocuments(); }
  else if (input === 'record-filter-status') { state.recordsFilter.status = t.value || ''; loadRecords(); }
}

function onScroll() {
  const header = document.getElementById('header');
  if (!header) return;
  if (window.scrollY > 20) {
    header.classList.add('glass-panel', 'shadow-sm', 'py-3');
    header.classList.remove('bg-transparent', 'py-5');
  } else {
    header.classList.remove('glass-panel', 'shadow-sm', 'py-3');
    header.classList.add('bg-transparent', 'py-5');
  }
}

function onResize() {
  if (state.mobileNavOpen && window.matchMedia('(min-width: 768px)').matches) {
    setMobileNav(false);
  }
}

function onKeydown(e) {
  if (e.key === 'Escape' && state.mobileNavOpen) {
    e.preventDefault();
    setMobileNav(false);
    return;
  }
  if (e.key !== 'Enter') return;
  const t = e.target;
  if (t?.matches?.('[data-input="chat-text"]') && !e.shiftKey) {
    e.preventDefault();
    submitChatText();
  } else if (t?.matches?.('[data-input="auth-email"], [data-input="auth-password"], [data-input="auth-nickname"]')) {
    e.preventDefault();
    submitAuth();
  } else if (t?.matches?.('[data-input="checkin-email"]')) {
    e.preventDefault();
    submitCheckinEmail();
  } else if (t?.matches?.('[data-input="filter-q"]')) {
    e.preventDefault();
    applyQuery();
  } else if (t?.matches?.('[data-input="comment-body"]')) {
    e.preventDefault();
    const pid = t.closest('[data-bind="post-detail-body"]')?.querySelector('[data-action="SUBMIT_COMMENT"]')?.getAttribute('data-post-id');
    if (pid) submitComment(pid);
  }
}

/* --------------------------------------------------------------- dispatch */
function onClick(e) {
  const node = e.target.closest('[data-action]');
  if (!node) return;
  const action = node.getAttribute('data-action');
  const payload = node.getAttribute('data-payload');
  const fromMobileNav = Boolean(node.closest('[data-bind="mobile-nav"]'));
  const handlers = {
    CHANGE_VIEW: () => changeView(payload || 'home'),
    OPEN_AUTH: () => openAuth(node.getAttribute('data-mode') || 'login'),
    TOGGLE_MOBILE_NAV: () => setMobileNav(!state.mobileNavOpen),
    CLOSE_MOBILE_NAV: () => setMobileNav(false),
    TOGGLE_AUTH: () => { state.authMode = state.authMode === 'login' ? 'signup' : 'login'; renderAuthModal(); },
    SUBMIT_AUTH: () => submitAuth(),
    LOGOUT: () => logout(),
    CLOSE_MODAL: () => closeModal(),
    OPEN_BOOKINGS: () => openBookings(),
    BOOT_WIDGET: () => openChat(false),
    BOOT_FULLSCREEN: () => openChat(true),
    EXPAND_CHAT: () => { state.chat.expanded = !state.chat.expanded; renderChatShell(); },
    CLOSE_CHAT: () => { state.chat.open = false; renderChatShell(); },
    RETURN_HOME: () => { state.chat.open = false; changeView('home'); },
    SUBMIT_RAFI_MESSAGE: () => submitChatText(),
    NEW_CHAT: () => newChat(),
    SET_CHAT_MODE: () => setChatMode(node.getAttribute('data-mode')),
    SEND_CHIP: () => sendCheckinTurn(node.getAttribute('data-chip')),
    SUBMIT_CHECKIN_EMAIL: () => submitCheckinEmail(),
    RECOMMEND_COUNSELORS: () => { state.chat.open = false; renderChatShell(); changeView('find-expert'); runMatching(); },
    RUN_MATCHING: () => runMatching(),
    OPEN_BOOKING: () => openBooking(node.getAttribute('data-counselor-id')),
    SUBMIT_BOOKING: () => submitBooking(),
    CANCEL_BOOKING: () => cancelBooking(node.getAttribute('data-booking-id')),
    SET_ROOM: () => setRoom(node.getAttribute('data-room-id')),
    OPEN_POST_COMPOSE: () => openPostCompose(),
    SUBMIT_POST: () => submitPost(),
    OPEN_POST: () => openPost(node.getAttribute('data-post-id')),
    LIKE_POST: () => likePost(node.getAttribute('data-post-id')),
    SUBMIT_COMMENT: () => submitComment(node.getAttribute('data-post-id')),
    LOAD_CONVERSATION: () => loadConversation(node.getAttribute('data-conv-id')),
    // home search + categories
    HOME_SEARCH: () => homeSearch(),
    SEARCH_SPECIALTY: () => searchSpecialty(node.getAttribute('data-specialty') || ''),
    // 전문가 찾기 detail filters
    SET_FILTER: () => setFilter(node.getAttribute('data-facet'), node.getAttribute('data-value')),
    APPLY_QUERY: () => applyQuery(),
    RESET_FILTERS: () => resetFilters(),
    OPEN_COUNSELOR_DETAIL: () => openCounselorDetail(node.getAttribute('data-counselor-id')),
    // bookings (real backend list)
    BOOKING_TRANSITION: () => bookingTransition(node.getAttribute('data-booking-id'), node.getAttribute('data-status')),
    // admin counselor CRUD
    OPEN_COUNSELOR_FORM: () => openCounselorForm(node.getAttribute('data-counselor-id') || null),
    SUBMIT_COUNSELOR: () => submitCounselor(),
    APPROVE_COUNSELOR: () => updateCounselorStatus(node.getAttribute('data-counselor-id'), 'active'),
    DEACTIVATE_COUNSELOR: () => updateCounselorStatus(node.getAttribute('data-counselor-id'), 'inactive'),
    DELETE_COUNSELOR: () => deleteCounselor(node.getAttribute('data-counselor-id')),
    EXPORT_COUNSELORS: () => exportCounselorsCsv(),
    // documents
    SUBMIT_DOCUMENT: () => submitDocument(),
    RESET_DOCUMENT_FORM: () => resetDocumentForm(),
    RELOAD_DOCUMENTS: () => loadDocuments(),
    OPEN_DOCUMENT: () => openDocument(node.getAttribute('data-doc-id')),
    DELETE_DOCUMENT: () => deleteDocument(node.getAttribute('data-doc-id')),
    // records
    OPEN_RECORD_FORM: () => openRecordForm(),
    SUBMIT_RECORD: () => submitRecord(),
    RELOAD_RECORDS: () => loadRecords(),
    OPEN_RECORD: () => openRecord(node.getAttribute('data-record-id')),
    DELETE_RECORD: () => deleteRecord(node.getAttribute('data-record-id')),
  };
  const fn = handlers[action];
  if (!fn) return;
  e.preventDefault();
  e.stopPropagation();
  fn();
  if (fromMobileNav && action !== 'CLOSE_MOBILE_NAV') setMobileNav(false);
}

/* ------------------------------------------------------------------ views */
function setMobileNav(open) {
  state.mobileNavOpen = Boolean(open);
  renderMobileNav();
}

function renderMobileNav() {
  const nav = $bind('mobile-nav');
  const toggle = $bind('mobile-nav-toggle');
  const open = Boolean(state.mobileNavOpen);
  if (nav) nav.classList.toggle('hidden', !open);
  if (toggle) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? '모바일 메뉴 닫기' : '모바일 메뉴 열기');
    const icon = toggle.querySelector('i');
    if (icon) icon.className = open ? 'ph ph-x text-2xl' : 'ph ph-list text-2xl';
  }
  document.body.classList.toggle('overflow-hidden', open);
}

function changeView(view) {
  state.view = view;
  renderViewPanels();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (view === 'find-expert') { renderFilterControls(); loadCounselors(); }
  if (view === 'community') loadCommunity();
  if (view === 'admin-counselors') { renderAdminGate('admin-counselors-gate', isAdmin()); if (isAdmin()) loadCounselors(); }
  if (view === 'admin-docs') { renderAdminGate('admin-docs-gate', canManageDocs()); if (canManageDocs()) { if (!state.adminCounselors.length) loadCounselors(); else renderDocumentCounselorOptions(); loadDocuments(); } }
  if (view === 'admin-records') { renderAdminGate('admin-records-gate', canManageDocs()); if (canManageDocs()) { if (!state.adminCounselors.length) loadCounselors(); loadRecords(); } }
}

// Toggle an admin panel's body vs. its access-gate message.
function renderAdminGate(gateBind, allowed) {
  const gate = $bind(gateBind);
  const body = $bind(gateBind.replace('-gate', '-body'));
  if (gate) gate.classList.toggle('hidden', allowed);
  if (body) body.classList.toggle('hidden', !allowed);
}

function renderViewPanels() {
  document.querySelectorAll('[data-view-panel]').forEach((panel) => {
    panel.classList.toggle('active', panel.getAttribute('data-view-panel') === state.view);
  });
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    const active = btn.getAttribute('data-page') === state.view;
    btn.classList.toggle('text-primary', active);
    btn.classList.toggle('text-gray-600', !active);
  });
}

/* ------------------------------------------------------------------- auth */
function renderAuthArea() {
  const authArea = $bind('auth-area');
  const userArea = $bind('user-area');
  if (!authArea || !userArea) return;
  const loggedIn = Boolean(state.auth?.token);
  authArea.classList.toggle('hidden', loggedIn);
  authArea.classList.toggle('flex', !loggedIn);
  userArea.classList.toggle('hidden', !loggedIn);
  userArea.classList.toggle('flex', loggedIn);
  if (loggedIn) {
    const nick = state.auth.profile?.nickname || state.auth.account?.email || '이용자';
    const nameEl = $bind('user-name'); if (nameEl) nameEl.textContent = `${nick}님`;
    const avEl = $bind('user-avatar'); if (avEl) avEl.textContent = (nick[0] || 'U');
  }
  renderRoleUI();
}

// Show admin navigation only to roles that can use it; keep an admin badge visible.
function renderRoleUI() {
  const show = canManageDocs();
  document.querySelectorAll('[data-bind="admin-nav"]').forEach((el) => {
    // Use inline display so it overrides Tailwind's `hidden md:flex` cascade reliably.
    el.classList.remove('hidden');
    el.style.display = show ? '' : 'none';
  });
  const badge = $bind('role-badge');
  if (badge) {
    if (isAdmin()) { badge.textContent = '관리자'; badge.classList.remove('hidden'); }
    else if (role() === 'counselor') { badge.textContent = '상담사'; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
  }
}

function openAuth(mode) {
  state.authMode = mode === 'signup' ? 'signup' : 'login';
  ['auth-email', 'auth-password', 'auth-nickname'].forEach((k) => { const el = $(`[data-input="${k}"]`); if (el) el.value = ''; });
  openModal('auth');
  renderAuthModal();
  setTimeout(() => $('[data-input="auth-email"]')?.focus(), 50);
}

function renderAuthModal() {
  const isSignup = state.authMode === 'signup';
  const title = $bind('auth-title'); if (title) title.textContent = isSignup ? '회원가입' : '로그인';
  $bind('auth-nickname-row')?.classList.toggle('hidden', !isSignup);
  const consentRow = $bind('auth-consent-row');
  if (consentRow) { consentRow.classList.toggle('hidden', !isSignup); consentRow.classList.toggle('flex', isSignup); }
  const toggleText = $bind('auth-toggle-text'); if (toggleText) toggleText.textContent = isSignup ? '이미 계정이 있으신가요?' : '계정이 없으신가요?';
  const toggleBtn = $bind('auth-toggle-btn'); if (toggleBtn) toggleBtn.textContent = isSignup ? '로그인' : '회원가입';
  const emailLabel = $bind('auth-email-label'); if (emailLabel) emailLabel.textContent = isSignup ? '이메일' : '이메일 또는 아이디';
  const emailInput = $('[data-input="auth-email"]');
  if (emailInput) {
    emailInput.type = isSignup ? 'email' : 'text';
    emailInput.placeholder = isSignup ? 'you@example.com' : 'you@example.com 또는 admin';
  }
  hideError('auth-error');
}

async function submitAuth() {
  const email = $('[data-input="auth-email"]')?.value.trim();
  const password = $('[data-input="auth-password"]')?.value || '';
  const nickname = $('[data-input="auth-nickname"]')?.value.trim() || '익명봄';
  const consent = $('[data-input="auth-consent"]')?.checked ?? true;
  const isSignup = state.authMode === 'signup';
  if (!email || !password) {
    return showError('auth-error', isSignup ? '이메일과 비밀번호를 입력해주세요.' : '이메일 또는 아이디와 비밀번호를 입력해주세요.');
  }
  const submitBtn = $('[data-action="SUBMIT_AUTH"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '처리 중…'; }
  try {
    const body = isSignup
      ? { email, password, nickname, consent, role: 'user' }
      : { email, password };
    const data = await api(isSignup ? '/v1/accounts/signup' : '/v1/accounts/login', { method: 'POST', body, auth: false });
    state.auth = { token: data.token, account: data.account, profile: data.profile };
    saveJSON(LS.auth, state.auth);
    renderAuthArea();
    closeModal();
    changeView(state.view); // refresh gated admin panels for the new role
    toast(isSignup ? `환영해요, ${data.profile?.nickname || ''}님` : '로그인되었습니다.');
  } catch (err) {
    showError('auth-error', err.message || '인증에 실패했습니다.');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '계속하기'; }
  }
}

async function refreshMe() {
  try {
    const data = await api('/v1/accounts/me');
    state.auth = { ...state.auth, account: data.account, profile: data.profile };
    saveJSON(LS.auth, state.auth);
    renderAuthArea();
    if (state.view.startsWith('admin-')) changeView(state.view);
  } catch (err) {
    if (err.status === 401) logout(true);
  }
}

function logout(silent) {
  state.auth = null;
  saveJSON(LS.auth, null);
  state.ai = { conversationId: null, title: '', messages: [], pending: false };
  renderAuthArea();
  if (state.view.startsWith('admin-')) changeView('home');
  if (state.chat.open) renderChatBody();
  if (!silent) toast('로그아웃되었습니다.');
}

function requireAuth(message) {
  if (state.auth?.token) return true;
  toast(message || '로그인이 필요합니다.');
  openAuth('login');
  return false;
}

/* ------------------------------------------------------------------ modals */
function openModal(name) {
  state.modal = name;
  const el = $bind(`${name}-modal`);
  if (el) el.classList.remove('hidden');
}
function closeModal() {
  if (state.modal) {
    const el = $bind(`${state.modal}-modal`);
    if (el) el.classList.add('hidden');
  }
  state.modal = null;
}
function showError(bind, msg) { const el = $bind(bind); if (el) { el.textContent = msg; el.classList.remove('hidden'); } }
function hideError(bind) { const el = $bind(bind); if (el) el.classList.add('hidden'); }

/* ----------------------------------------------------------- chat (shell) */
function openChat(expanded) {
  state.chat.open = true;
  state.chat.expanded = Boolean(expanded);
  renderChatShell();
  if (state.chat.mode === 'checkin' && !state.checkin.sessionId && !state.checkin.starting) {
    startCheckin();
  } else {
    renderChatBody();
  }
}

function setChatMode(mode) {
  if (mode !== 'checkin' && mode !== 'ai') return;
  if (mode === 'ai' && !requireAuth('AI 상담은 로그인 후 이용할 수 있어요.')) return;
  state.chat.mode = mode;
  const statusEl = $bind('chat-status-text');
  if (statusEl) statusEl.textContent = mode === 'ai' ? 'AI 상담 · 기억 기반 대화' : 'AI 보조 진단 시스템 동작 중';
  if (mode === 'checkin' && !state.checkin.sessionId && !state.checkin.starting) startCheckin();
  else renderChatBody();
}

function renderChatShell() {
  const overlay = $bind('chat-overlay');
  const fab = $bind('fab');
  const main = $bind('chat-main');
  const sidebar = $bind('chat-sidebar');
  const expandIcon = $('[data-bind="expand-btn"] i');
  const blocker = $bind('chat-blocker');
  if (!overlay || !fab || !main || !sidebar) return;

  overlay.classList.toggle('hidden', !state.chat.open);
  fab.classList.toggle('hidden', state.chat.open);

  if (state.chat.expanded) {
    overlay.classList.remove('bottom-6', 'right-6', 'rounded-[32px]', 'w-[380px]', 'sm:w-[420px]', 'h-[680px]');
    overlay.classList.add('bottom-0', 'right-0', 'w-full', 'h-full', 'rounded-none');
    sidebar.classList.remove('hidden');
    sidebar.classList.add('md:flex', 'flex');
    main.classList.add('flex-1', 'rounded-l-none', 'md:rounded-l-[32px]', 'shadow-[-20px_0_50px_-20px_rgba(0,0,0,0.1)]', 'z-30', 'm-0', 'md:m-4', 'md:ml-[320px]');
    if (expandIcon) expandIcon.className = 'ph-bold ph-arrows-in-simple text-lg';
  } else {
    overlay.classList.remove('bottom-0', 'right-0', 'w-full', 'h-full', 'rounded-none');
    overlay.classList.add('bottom-6', 'right-6', 'rounded-[32px]', 'w-[380px]', 'sm:w-[420px]', 'h-[680px]');
    sidebar.classList.add('hidden');
    sidebar.classList.remove('md:flex', 'flex');
    main.classList.remove('flex-1', 'rounded-l-none', 'md:rounded-l-[32px]', 'shadow-[-20px_0_50px_-20px_rgba(0,0,0,0.1)]', 'z-30', 'm-0', 'md:m-4', 'md:ml-[320px]');
    if (expandIcon) expandIcon.className = 'ph-bold ph-arrows-out-simple text-lg';
  }

  if (blocker) blocker.classList.toggle('hidden', state.chat.status !== 'crisis');
  renderSidebar();
  renderChatBody();
}

function renderSidebar() {
  const sidebar = $bind('chat-sidebar');
  if (!sidebar) return;
  const newBtn = sidebar.querySelector('button[title="새 상담 시작"]');
  if (newBtn) newBtn.setAttribute('data-action', 'NEW_CHAT');
  const scroll = sidebar.querySelector('.chat-scroll');
  if (scroll) {
    if (!state.auth?.token) {
      scroll.innerHTML = `<div class="text-[13px] text-gray-400 px-2 py-6 text-center leading-relaxed">로그인하면 AI 상담 대화가<br/>여기에 저장됩니다.</div>`;
    } else if (!state.conversations.length) {
      scroll.innerHTML = `<div class="text-[13px] text-gray-400 px-2 py-6 text-center leading-relaxed">아직 저장된 AI 상담이 없어요.<br/>아래에서 새 상담을 시작해보세요.</div>`;
    } else {
      scroll.innerHTML = `<div><p class="text-[11px] font-bold tracking-wider text-gray-400 mb-3 px-2 uppercase">AI 상담 기록</p><div class="space-y-2">${
        state.conversations.map((c) => {
          const active = c.id === state.ai.conversationId;
          return `<button data-action="LOAD_CONVERSATION" data-conv-id="${escapeAttr(c.id)}" class="w-full text-left ${active ? 'bg-primary/5 border-primary/20 border-l-primary' : 'hover:bg-gray-50 border-transparent hover:border-gray-100 border-l-transparent'} border rounded-2xl p-4 border-l-4 transition-all group">
            <h4 class="text-[14px] ${active ? 'text-gray-900' : 'text-gray-700 group-hover:text-primary'} font-bold truncate">${escapeHtml(c.title || 'AI 상담')}</h4>
            <p class="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">${escapeHtml(c.preview || '')}</p>
          </button>`;
        }).join('')
      }</div></div>`;
    }
  }
  // sidebar footer user chip
  const footName = sidebar.querySelector('.mt-auto .text-\\[14px\\]');
  if (footName) footName.textContent = state.auth?.token ? `${state.auth.profile?.nickname || '이용자'}님` : '익명 이용자님';
  const footRole = sidebar.querySelector('.mt-auto .text-primary');
  if (footRole) footRole.textContent = state.auth?.token ? '로그인됨' : '무료 진단 모드';
}

function modeToggleHtml() {
  const mk = (mode, label) => {
    const active = state.chat.mode === mode;
    return `<button data-action="SET_CHAT_MODE" data-mode="${mode}" class="flex-1 py-2 rounded-xl text-[13px] font-bold transition-all ${active ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}">${label}</button>`;
  };
  return `<div class="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-1">${mk('checkin', '마음 체크인')}${mk('ai', 'AI 상담')}</div>`;
}

function avatarBubble(inner, wide) {
  return `<div class="flex gap-3 ${wide ? 'max-w-[95%]' : 'max-w-[90%]'} april-message">
    <div class="w-9 h-9 rounded-full bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center flex-shrink-0 border border-primary/10 mt-1"><span class="text-primary font-bold text-sm">랄</span></div>
    ${inner}
  </div>`;
}
function assistantBubble(html) {
  return avatarBubble(`<div class="bg-white border border-gray-200 p-4 rounded-3xl rounded-tl-sm shadow-sm text-[15px] text-gray-700 leading-relaxed">${html}</div>`);
}
function userBubble(text) {
  return `<div class="flex justify-end gap-3 max-w-[90%] ml-auto april-message"><div class="bg-primary text-white p-4 rounded-3xl rounded-tr-sm shadow-md text-[15px] leading-relaxed whitespace-pre-wrap">${escapeHtml(text)}</div></div>`;
}
function typingBubble() {
  return avatarBubble(`<div class="bg-white border border-gray-200 p-4 rounded-3xl rounded-tl-sm shadow-sm text-[15px] text-gray-700"><div class="flex space-x-1"><div class="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div><div class="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style="animation-delay:0.1s"></div><div class="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style="animation-delay:0.2s"></div></div></div>`);
}

function renderChatBody() {
  const container = $bind('chat-messages');
  if (!container) return;
  const parts = [modeToggleHtml()];
  if (state.chat.mode === 'checkin') parts.push(renderCheckinBody());
  else parts.push(renderAiBody());
  container.innerHTML = parts.join('');
  const scroller = container.parentElement || container;
  scroller.scrollTop = scroller.scrollHeight;
  const statusEl = $bind('chat-status-text');
  if (statusEl) {
    if (state.chat.status === 'crisis') statusEl.textContent = '위기 감지됨';
    else if (state.chat.pending) statusEl.textContent = '답변 작성 중…';
    else statusEl.textContent = state.chat.mode === 'ai' ? 'AI 상담 · 기억 기반 대화' : 'AI 보조 진단 시스템 동작 중';
  }
}

/* -------------------------------------------------------- 마음 체크인 flow */
async function startCheckin() {
  state.checkin = { sessionId: null, messages: [], chips: [], stage: 'collecting', result: null, starting: true };
  state.chat.pending = true; state.chat.status = 'idle';
  renderChatBody();
  try {
    const data = await api('/v1/checkins', { method: 'POST', body: { accountId: state.auth?.account?.id || null }, auth: false });
    applyCheckin(data, null);
    state.checkin.sessionId = data.sessionId;
  } catch (err) {
    state.checkin.messages.push({ role: 'assistant', text: `체크인을 시작하지 못했어요: ${err.message}` });
  } finally {
    state.checkin.starting = false; state.chat.pending = false;
    renderChatBody();
  }
}

function applyCheckin(data, userText) {
  if (userText) state.checkin.messages.push({ role: 'user', text: userText });
  const bot = data.lastBotMessage;
  if (bot && bot.text) state.checkin.messages.push({ role: 'assistant', text: bot.text });
  state.checkin.chips = (bot && Array.isArray(bot.chips)) ? bot.chips : [];
  state.checkin.stage = data.stage;
  state.checkin.result = data.result || state.checkin.result;
  state.chat.status = data.stage === 'crisis' ? 'crisis' : 'idle';
}

async function sendCheckinTurn(text) {
  const value = String(text || '').trim();
  if (!value || state.chat.pending || !state.checkin.sessionId) return;
  if (state.checkin.stage === 'crisis') return;
  state.chat.pending = true;
  state.checkin.messages.push({ role: 'user', text: value });
  state.checkin.chips = [];
  renderChatBody();
  try {
    const data = await api(`/v1/checkins/${encodeURIComponent(state.checkin.sessionId)}/turn`, { method: 'POST', body: { text: value }, auth: false });
    applyCheckin(data, null);
  } catch (err) {
    state.checkin.messages.push({ role: 'assistant', text: `오류가 발생했어요: ${err.message}` });
  } finally {
    state.chat.pending = false;
    renderChatShell();
  }
}

async function submitCheckinEmail() {
  const input = $('[data-input="checkin-email"]');
  const email = (input?.value || state.auth?.account?.email || '').trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('올바른 이메일을 입력해주세요.');
  if (state.chat.pending || !state.checkin.sessionId) return;
  state.chat.pending = true; renderChatBody();
  try {
    const data = await api(`/v1/checkins/${encodeURIComponent(state.checkin.sessionId)}/email`, { method: 'POST', body: { email }, auth: false });
    applyCheckin(data, null);
    toast('결과가 정리되었어요.');
  } catch (err) {
    toast(err.message || '이메일 제출에 실패했어요.');
  } finally {
    state.chat.pending = false; renderChatShell();
  }
}

function renderCheckinBody() {
  const c = state.checkin;
  let html = `<div class="flex justify-center my-2"><div class="bg-gray-100 text-gray-500 text-[11px] font-bold px-4 py-1.5 rounded-full border border-gray-200">마음 체크인 · 진단이 아닌 방향 안내</div></div>`;
  if (!c.messages.length && !c.starting) {
    html += assistantBubble('안녕하세요. 저는 랄피예요.<br/><br/>진단은 하지 않고, 지금 필요한 방향을 함께 정리할게요. 요즘 마음이 어떠신지 편하게 들려주세요.');
  }
  for (const m of c.messages) {
    html += m.role === 'user' ? userBubble(m.text) : assistantBubble(renderMarkdown(m.text));
  }
  if (state.chat.pending) html += typingBubble();

  // crisis card
  if (c.stage === 'crisis') {
    html += avatarBubble(`<div class="bg-red-50 border-2 border-red-200 p-5 rounded-3xl shadow-sm w-full">
      <h4 class="font-bold text-red-900 mb-2 flex items-center gap-2 text-[16px]"><i class="ph-fill ph-warning-circle text-red-500 text-xl"></i> 지금은 안전이 가장 중요해요</h4>
      <p class="text-[14px] text-red-800 leading-relaxed mb-3">${escapeHtml(c.result?.summaryLine || '혼자 견디지 않으셔도 됩니다. 지금 바로 도움을 받을 수 있어요.')}</p>
      <div class="bg-white rounded-2xl px-4 py-3 text-[14px] font-bold text-red-700 border border-red-100">자살예방상담전화 <span class="text-red-600 text-[16px]">109</span> · 24시간 연결됩니다.</div>
    </div>`, true);
  } else if (!state.chat.pending && c.chips.length) {
    // quick reply chips
    html += `<div class="flex flex-wrap gap-2 pl-12">${
      c.chips.map((chip) => `<button data-action="SEND_CHIP" data-chip="${escapeAttr(chip)}" class="px-4 py-2 rounded-full bg-white border border-primary/20 text-primary text-[13px] font-bold hover:bg-primary/5 transition-all shadow-sm">${escapeHtml(chip)}</button>`).join('')
    }</div>`;
  }

  // result / email gate
  if (c.result && (c.stage === 'email' || c.stage === 'result')) {
    html += renderDirectionCard(c.result, c.stage === 'email');
  }
  return html;
}

function renderDirectionCard(result, emailGate) {
  const title = result.title || 'AI 초기 방향 제안';
  const summary = result.summaryLine || '필요한 방향을 함께 정리했어요.';
  const body = result.emailBody ? `<p class="text-[13px] text-gray-600 leading-relaxed mb-4">${escapeHtml(result.emailBody)}</p>` : '';
  const emailForm = emailGate ? `
    <div class="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-4">
      <p class="text-[13px] font-bold text-gray-700 mb-2">자세한 결과를 이메일로 받아보세요</p>
      <div class="flex gap-2">
        <input data-input="checkin-email" type="email" value="${escapeAttr(state.auth?.account?.email || '')}" placeholder="you@example.com" class="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] focus:outline-none focus:border-primary" />
        <button data-action="SUBMIT_CHECKIN_EMAIL" class="px-4 py-2.5 bg-primary text-white rounded-xl text-[14px] font-bold whitespace-nowrap">받기</button>
      </div>
    </div>` : '';
  return avatarBubble(`<div class="w-full space-y-3">
    <div class="bg-white border-2 border-primary/20 p-5 rounded-3xl shadow-sm relative overflow-hidden">
      <div class="absolute top-0 left-0 w-1 h-full bg-primary"></div>
      <h4 class="font-bold text-gray-900 mb-3 flex items-center gap-2 text-[16px]"><i class="ph-fill ph-compass text-primary text-xl"></i> ${escapeHtml(title)}</h4>
      <div class="bg-blue-50 text-blue-700 px-4 py-3 rounded-2xl text-[14px] font-bold mb-4 flex items-center justify-center gap-2 text-center"><i class="ph-fill ph-first-aid"></i> ${escapeHtml(summary)}</div>
      ${body}
      ${emailForm}
      <ul class="text-[13px] text-gray-600 space-y-2 list-none mb-4 bg-gray-50 p-4 rounded-2xl">
        <li class="flex items-start gap-2"><i class="ph-bold ph-check text-primary mt-0.5"></i><span>이 결과는 진단이 아니라 방향 설정용 안내입니다.</span></li>
        <li class="flex items-start gap-2"><i class="ph-bold ph-check text-primary mt-0.5"></i><span>필요하면 사람 전문가와 연결해 더 구체화할 수 있어요.</span></li>
      </ul>
      <button data-action="RECOMMEND_COUNSELORS" class="w-full py-3.5 bg-gradient-to-r from-primary to-secondary text-white rounded-2xl text-[15px] font-bold shadow-md transition-all hover:-translate-y-0.5 flex justify-center items-center gap-2"><i class="ph-bold ph-user-plus text-lg"></i> 내 상태에 맞는 상담사 추천받기</button>
    </div>
  </div>`, true);
}

/* ----------------------------------------------------------- AI 상담 chat */
function renderAiBody() {
  let html = `<div class="flex justify-center my-2"><div class="bg-primary/10 text-primary text-[11px] font-bold px-4 py-1.5 rounded-full border border-primary/15 flex items-center gap-1.5"><i class="ph-fill ph-brain"></i> 기억 기반 AI 상담</div></div>`;
  if (!state.auth?.token) {
    html += assistantBubble('AI 상담은 로그인 후 이용할 수 있어요. 상단의 <strong class="text-primary">로그인</strong> 버튼을 눌러주세요.');
    return html;
  }
  if (!state.ai.messages.length) {
    html += assistantBubble('안녕하세요. 저는 AI 랄피예요. 🌿<br/><br/>마음 체크인과 지난 대화가 <strong class="text-primary">기억</strong>으로 함께 참고됩니다. 무엇이든 편하게 이야기해주세요.');
  }
  for (const m of state.ai.messages) {
    if (m.role === 'user') { html += userBubble(m.text); continue; }
    html += avatarBubble(`<div class="w-full"><div class="bg-white border border-gray-200 p-4 rounded-3xl rounded-tl-sm shadow-sm text-[15px] text-gray-700 leading-relaxed">${renderMarkdown(m.text)}</div>${m.grounding ? memoryIndicator(m.grounding) : ''}</div>`, true);
  }
  if (state.chat.pending) html += typingBubble();
  return html;
}

function memoryIndicator(g) {
  const cited = Array.isArray(g.citedChunkIds) ? g.citedChunkIds.length : 0;
  const sufficient = g.evidenceSufficient;
  const label = cited > 0 ? `기억 ${cited}개 참고` : '기억 참고 없음';
  const tone = sufficient ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-gray-500 bg-gray-50 border-gray-200';
  return `<div class="mt-2 inline-flex items-center gap-1.5 ${tone} border rounded-full px-3 py-1 text-[11px] font-bold"><i class="ph-fill ph-brain"></i> ${label}${sufficient ? ' · 근거 충분' : ''}</div>`;
}

function submitChatText() {
  const input = $('[data-input="chat-text"]');
  const text = (input?.value || '').trim();
  if (!text) return;
  if (input) input.value = '';
  if (state.chat.mode === 'checkin') {
    if (state.checkin.stage === 'email') { /* route to email if it looks like one */
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) { const e = $('[data-input="checkin-email"]'); if (e) e.value = text; return submitCheckinEmail(); }
    }
    return sendCheckinTurn(text);
  }
  return sendAiMessage(text);
}

async function sendAiMessage(text) {
  if (!requireAuth('AI 상담은 로그인 후 이용할 수 있어요.')) return;
  if (state.chat.pending) return;
  state.chat.pending = true;
  state.ai.messages.push({ role: 'user', text });
  renderChatBody();
  try {
    if (!state.ai.conversationId) await createConversation(text);
    const data = await api(`/v1/ai/conversations/${encodeURIComponent(state.ai.conversationId)}/messages`, { method: 'POST', body: { message: text } });
    const reply = data.reply || {};
    state.ai.messages.push({ role: 'assistant', text: reply.text || '(빈 응답)', grounding: data.grounding || reply.grounding || null });
    updateConversationMeta(reply.text);
  } catch (err) {
    state.ai.messages.push({ role: 'assistant', text: `오류가 발생했어요: ${err.message}` });
  } finally {
    state.chat.pending = false;
    renderChatBody();
    renderSidebar();
  }
}

async function createConversation(firstMessage) {
  const seed = buildSeedMemory();
  const title = firstMessage.slice(0, 24) || '마음 대화';
  const data = await api('/v1/ai/conversations', { method: 'POST', body: { title, seedMemory: seed } });
  state.ai.conversationId = data.id;
  state.ai.title = data.title || title;
  state.conversations.unshift({ id: data.id, title: state.ai.title, preview: '', updatedAt: data.updatedAt || new Date().toISOString() });
  state.conversations = state.conversations.slice(0, 30);
  saveJSON(LS.convs, state.conversations);
}

function buildSeedMemory() {
  const r = state.checkin.result;
  if (r && r.values) {
    const v = r.values;
    return `사용자의 마음 체크인 결과: ${r.title || ''} - ${r.summaryLine || ''}. 지속기간:${v.duration}, 일상지장:${v.impact}, 신체증상:${v.somatic}, 목표:${v.goal}.`;
  }
  return '사용자가 랄피에서 마음 상담을 시작했습니다. 따뜻하고 비진단적인 태도로 도와주세요.';
}

function updateConversationMeta(preview) {
  const conv = state.conversations.find((c) => c.id === state.ai.conversationId);
  if (conv) {
    conv.preview = (preview || '').replace(/[#*`>]/g, '').slice(0, 80);
    conv.updatedAt = new Date().toISOString();
    saveJSON(LS.convs, state.conversations);
  }
}

function newChat() {
  if (state.chat.mode === 'ai') {
    if (!requireAuth('AI 상담은 로그인 후 이용할 수 있어요.')) return;
    state.ai = { conversationId: null, title: '', messages: [], pending: false };
  } else {
    startCheckin();
    return;
  }
  renderChatShell();
}

async function loadConversation(convId) {
  if (!convId || !requireAuth()) return;
  state.chat.mode = 'ai';
  state.ai.conversationId = convId;
  state.ai.messages = [];
  state.chat.pending = true;
  renderChatBody();
  try {
    const data = await api(`/v1/ai/conversations/${encodeURIComponent(convId)}/messages`);
    const items = Array.isArray(data.items) ? data.items : [];
    state.ai.messages = items.map((m) => ({ role: m.role, text: m.text, grounding: (m.role === 'assistant' && m.grounding && Object.keys(m.grounding).length) ? m.grounding : null }));
  } catch (err) {
    toast(err.message || '대화를 불러오지 못했어요.');
  } finally {
    state.chat.pending = false;
    renderChatBody();
    renderSidebar();
  }
}

/* ------------------------------------------------------- counselors/match */
const SPECIALTY_KO = {
  somatic: '신체·수면', sleep: '수면', depression: '우울', clinical: '임상',
  relationship: '관계', self_understanding: '자기이해', work_stress: '직무 스트레스',
  stress: '스트레스', anxiety: '불안', adolescent: '청소년', burnout: '번아웃',
  career: '커리어', couple: '부부·커플', emotion_regulation: '정서조절',
  family: '가족', grief: '상실·애도', habit: '습관', identity: '정체성',
  life_transition: '삶의 전환', parenting: '양육', self_esteem: '자존감',
  trauma: '트라우마',
};
const APPROACH_KO = {
  stabilization: '안정화', body: '신체 기반', symptom_relief: '증상 완화',
  insight: '통찰', pattern: '패턴 분석', narrative: '이야기 치료',
  integrative: '통합', mindfulness: '마음챙김', act: '수용전념(ACT)',
  cbt: '인지행동(CBT)', eft: '정서중심(EFT)', emotion_focused: '정서초점',
  family_systems: '가족체계', solution_focused: '해결중심',
};
const REGION_KO = {
  seoul: '서울', busan: '부산', incheon: '인천', daegu: '대구', daejeon: '대전',
  gwangju: '광주', jeju: '제주', online: '비대면',
};
const DOC_TYPE_KO = { intake: '초기 상담', progress: '정기 상담', closing: '종결 상담' };
const RECORD_STATUS_KO = {
  scheduled: '예정', in_progress: '진행 중', completed: '완료', cancelled: '취소', followup: '후속 관리',
};
// Facet option lists for the 전문가 찾기 detail filters (only values that exist in data).
const FILTER_SPECIALTIES = ['relationship', 'family', 'couple', 'parenting', 'sleep', 'somatic', 'depression', 'burnout', 'work_stress', 'stress', 'trauma', 'grief', 'self_esteem', 'self_understanding', 'identity', 'emotion_regulation', 'habit', 'life_transition', 'adolescent', 'career', 'clinical'];
const FILTER_APPROACHES = ['cbt', 'act', 'eft', 'mindfulness', 'solution_focused', 'emotion_focused', 'family_systems', 'integrative', 'insight', 'narrative', 'pattern', 'stabilization', 'body', 'symptom_relief'];
const FILTER_REGIONS = ['seoul', 'busan', 'incheon', 'daegu', 'daejeon', 'gwangju', 'jeju', 'online'];
const FILTER_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_KO = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };
const REASON_KO = {
  clinical: '임상 적합', symptom_relief: '증상 완화', somatic: '신체 기반',
  impact: '일상 지장', insight: '통찰 중심', pattern: '패턴 분석', goal: '목표 부합',
};

function buildCounselorQuery() {
  const f = state.filters;
  const params = new URLSearchParams({ limit: '100', offset: '0' });
  if (f.specialty) params.set('specialty', f.specialty);
  if (f.approach) params.set('approach', f.approach);
  if (f.region) params.set('region', f.region);
  if (f.availability) params.set('availability', f.availability);
  if (f.q) params.set('q', f.q);
  return params.toString();
}

async function loadCounselors() {
  const grid = $bind('counselor-grid');
  if (grid && state.view === 'find-expert') grid.innerHTML = `<div class="col-span-full text-center text-gray-400 py-12 text-[14px]">상담사를 불러오는 중…</div>`;
  try {
    const data = await api(`/v1/counselors?${buildCounselorQuery()}`, { auth: false });
    state.counselors = Array.isArray(data.items) ? data.items : [];
    state.counselorsLoaded = true;
    // active counselors fetched live also refresh the admin cache (status snapshot)
    if (isAdmin()) mergeAdminCounselors(state.counselors);
    renderHomeFeaturedCounselors();
    renderCounselors();
    renderAdminCounselors();
    if (canManageDocs()) renderDocumentCounselorOptions();
  } catch (err) {
    console.warn('[carebridge] counselors load failed', err);
    if (grid && state.view === 'find-expert') grid.innerHTML = `<div class="col-span-full text-center text-gray-400 py-12 text-[14px]">${escapeHtml(err.message || '상담사를 불러오지 못했어요.')}</div>`;
    renderHomeFeaturedError(err);
  }
}

function counselorById(id) {
  return state.counselors.find((c) => c.id === id) || state.adminCounselors.find((c) => c.id === id);
}

function renderHomeFeaturedCounselors() {
  const rail = $bind('home-featured-counselors');
  if (!rail) return;
  const featured = state.counselors
    .filter((c) => c && c.id && c.status === 'active')
    .slice()
    .sort((a, b) => {
      const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0);
      if (ratingDiff) return ratingDiff;
      const yearsDiff = Number(b.years || 0) - Number(a.years || 0);
      if (yearsDiff) return yearsDiff;
      return String(a.displayName || '').localeCompare(String(b.displayName || ''), 'ko');
    })
    .slice(0, 6);
  if (!featured.length) {
    rail.innerHTML = `<div class="min-w-[300px] bg-white rounded-[32px] shadow-soft border border-gray-100 flex-shrink-0 snap-center"><div class="p-8 text-center text-gray-400 text-[14px]">표시할 상담사가 없습니다.</div></div>`;
    return;
  }
  rail.innerHTML = featured.map((c, i) => homeFeaturedCounselorCard(c, i)).join('');
}

function renderHomeFeaturedError(err) {
  const rail = $bind('home-featured-counselors');
  if (!rail) return;
  rail.innerHTML = `<div class="min-w-[300px] bg-white rounded-[32px] shadow-soft border border-gray-100 flex-shrink-0 snap-center"><div class="p-8 text-center text-gray-400 text-[14px]">${escapeHtml(err?.message || '상담사를 불러오지 못했어요.')}</div></div>`;
}

function homeFeaturedCounselorCard(c, idx) {
  const initials = (c.displayName || '상')[0];
  const spec = (c.specialties || []).slice(0, 2).map((s) => SPECIALTY_KO[s] || s).join(' · ') || '정서 케어';
  const appr = (c.approach || []).slice(0, 2).map((a) => APPROACH_KO[a] || a).join(' · ') || '상담 방식 문의';
  const region = REGION_KO[c.region] || c.region || '지역 문의';
  const price = c.price ? `${Number(c.price).toLocaleString('ko-KR')}원` : '상담료 문의';
  const rating = c.rating != null ? escapeHtml(String(c.rating)) : '-';
  const palette = ['bg-blue-50 text-blue-700 border-blue-100', 'bg-indigo-50 text-indigo-700 border-indigo-100', 'bg-emerald-50 text-emerald-700 border-emerald-100', 'bg-purple-50 text-purple-700 border-purple-100', 'bg-amber-50 text-amber-700 border-amber-100', 'bg-rose-50 text-rose-700 border-rose-100'];
  const tag = palette[idx % palette.length];
  const portrait = c.profileImage
    ? `<img src="${escapeAttr(c.profileImage)}" alt="${escapeAttr(c.displayName || '상담사')}" class="relative w-full h-full object-cover rounded-full border-4 border-white shadow-md group-hover:border-primary/10 transition-colors" />`
    : `<div class="relative w-full h-full rounded-full border-4 border-white shadow-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-4xl font-bold">${escapeHtml(initials)}</div>`;
  return `<div data-action="OPEN_COUNSELOR_DETAIL" data-counselor-id="${escapeAttr(c.id)}" class="min-w-[300px] bg-white rounded-[32px] shadow-soft hover:shadow-float transition-all duration-300 border border-gray-100 flex-shrink-0 snap-center group cursor-pointer hover:-translate-y-1">
    <div class="p-8 text-center relative overflow-hidden">
      <div class="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-gray-50 to-transparent"></div>
      <span class="relative z-10 inline-block px-4 py-1.5 rounded-full text-xs font-bold mb-6 border ${tag}">${escapeHtml(spec)}</span>
      <div class="relative w-28 h-28 mx-auto mb-5 z-10">
        <div class="absolute inset-0 bg-primary/20 rounded-full animate-pulse-slow blur-md"></div>
        ${portrait}
      </div>
      <h3 class="text-xl font-bold text-gray-900 mb-1 font-display relative z-10">${escapeHtml(c.displayName || '상담사')}</h3>
      <p class="text-[14px] text-gray-500 font-medium mb-4 relative z-10">${escapeHtml(region)} · ${escapeHtml(appr)}</p>
      <div class="flex items-center justify-center gap-1.5 text-sm mb-6 bg-gray-50 py-2 rounded-xl relative z-10">
        <i class="ph-fill ph-star text-amber-400 text-lg"></i>
        <span class="font-bold text-gray-800 text-[15px]">${rating}</span>
        <span class="text-gray-400 font-medium">경력 ${escapeHtml(String(c.years ?? '-'))}년</span>
      </div>
      <div class="pt-5 border-t border-gray-100 flex items-center justify-between text-gray-900 relative z-10">
        <span class="text-[13px] text-gray-500 font-medium">상담료</span>
        <span class="font-display font-bold text-xl text-primary">${escapeHtml(price)}</span>
      </div>
    </div>
  </div>`;
}

/* --------------------------------------------------- home search + chips */
function renderHomeSearchOptions() {
  const fill = (bind, list, koMap, placeholder) => {
    const sel = $bind(bind);
    if (!sel) return;
    sel.innerHTML = `<option value="">${placeholder}</option>` +
      list.map((v) => `<option value="${escapeAttr(v)}">${escapeHtml(koMap[v] || v)}</option>`).join('');
  };
  fill('home-specialty', FILTER_SPECIALTIES, SPECIALTY_KO, '상담 분야 선택');
  fill('home-approach', FILTER_APPROACHES, APPROACH_KO, '상담 방식 선택');
  fill('home-region', FILTER_REGIONS, REGION_KO, '지역 선택');
}

function homeSearch() {
  state.filters = {
    specialty: $bind('home-specialty')?.value || '',
    approach: $bind('home-approach')?.value || '',
    region: $bind('home-region')?.value || '',
    availability: '',
    q: '',
  };
  state.matchActive = false;
  changeView('find-expert');
}

function searchSpecialty(specialty) {
  state.filters = { specialty: specialty || '', approach: '', region: '', availability: '', q: '' };
  state.matchActive = false;
  changeView('find-expert');
}

/* ------------------------------------------- 전문가 찾기 detail filters */
function setFilter(facet, value) {
  if (!facet) return;
  state.filters[facet] = state.filters[facet] === value ? '' : value; // toggle
  state.matchActive = false;
  renderFilterControls();
  loadCounselors();
}

function applyQuery() {
  state.filters.q = ($('[data-input="filter-q"]')?.value || '').trim();
  state.matchActive = false;
  loadCounselors();
}

function resetFilters() {
  state.filters = { specialty: '', approach: '', region: '', availability: '', q: '' };
  state.matchActive = false;
  const q = $('[data-input="filter-q"]'); if (q) q.value = '';
  renderFilterControls();
  loadCounselors();
}

function renderFilterControls() {
  const chip = (facet, value, label) => {
    const active = state.filters[facet] === value;
    return `<button data-action="SET_FILTER" data-facet="${facet}" data-value="${escapeAttr(value)}" class="px-3 py-1.5 rounded-full text-[13px] font-bold border transition-all ${active ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary'}">${escapeHtml(label)}</button>`;
  };
  const spec = $bind('filter-specialty');
  if (spec) spec.innerHTML = FILTER_SPECIALTIES.map((v) => chip('specialty', v, SPECIALTY_KO[v] || v)).join('');
  const appr = $bind('filter-approach');
  if (appr) appr.innerHTML = FILTER_APPROACHES.map((v) => chip('approach', v, APPROACH_KO[v] || v)).join('');
  const reg = $bind('filter-region');
  if (reg) reg.innerHTML = FILTER_REGIONS.map((v) => chip('region', v, REGION_KO[v] || v)).join('');
  const day = $bind('filter-availability');
  if (day) day.innerHTML = FILTER_DAYS.map((v) => chip('availability', v, DAY_KO[v] || v)).join('');
  // active filter summary
  const summary = $bind('filter-summary');
  if (summary) {
    const f = state.filters;
    const parts = [];
    if (f.q) parts.push(`검색 “${escapeHtml(f.q)}”`);
    if (f.specialty) parts.push(SPECIALTY_KO[f.specialty] || f.specialty);
    if (f.approach) parts.push(APPROACH_KO[f.approach] || f.approach);
    if (f.region) parts.push(REGION_KO[f.region] || f.region);
    if (f.availability) parts.push(`${DAY_KO[f.availability]}요일`);
    summary.innerHTML = parts.length
      ? parts.map((p) => `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-bold bg-primary/10 text-primary border border-primary/15">${p}</span>`).join(' ')
      : `<span class="text-[13px] text-gray-400">전체 상담사를 보고 있어요.</span>`;
  }
}

function renderCounselors() {
  const grid = $bind('counselor-grid');
  if (!grid) return;
  const countEl = $bind('counselor-count');
  let rows = state.counselors.map((c) => ({ counselor: c, score: null, reasons: [] }));
  if (state.matchActive && state.matches.length) {
    rows = state.matches.map((m) => ({ counselor: m.counselor, score: m.score, reasons: m.reasons || [] }));
  }
  if (countEl) countEl.textContent = `${state.counselors.length}명`;
  if (!rows.length) {
    const filtered = state.filters.specialty || state.filters.approach || state.filters.region || state.filters.availability || state.filters.q;
    grid.innerHTML = filtered
      ? `<div class="col-span-full text-center py-16"><i class="ph-fill ph-magnifying-glass text-4xl text-gray-300 mb-3 block"></i><p class="text-gray-500 text-[15px] font-bold mb-1">조건에 맞는 상담사가 없어요.</p><p class="text-gray-400 text-[13px] mb-4">필터를 조정하거나 초기화해 보세요.</p><button data-action="RESET_FILTERS" class="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-[14px] font-bold hover:bg-gray-800 transition-colors">필터 초기화</button></div>`
      : `<div class="col-span-full text-center text-gray-400 py-12 text-[14px]">상담사를 불러오는 중…</div>`;
    return;
  }
  grid.innerHTML = rows.map((r, i) => counselorCard(r.counselor, r.score, r.reasons, i)).join('');
}

function counselorCard(c, score, reasons, idx) {
  const initials = (c.displayName || '상')[0];
  const spec = (c.specialties || []).slice(0, 3).map((s) => SPECIALTY_KO[s] || s).join(' · ') || '정서 케어';
  const appr = (c.approach || []).map((a) => APPROACH_KO[a] || a).join(', ');
  const days = Object.keys(c.availability || {}).map((d) => DAY_KO[d] || d).join('·');
  const palette = ['bg-blue-50 text-blue-700 border-blue-100', 'bg-indigo-50 text-indigo-700 border-indigo-100', 'bg-emerald-50 text-emerald-700 border-emerald-100', 'bg-purple-50 text-purple-700 border-purple-100'];
  const tag = palette[idx % palette.length];
  const scoreBadge = score != null
    ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/15"><i class="ph-fill ph-magic-wand"></i> 매칭 ${score}</span>`
    : '';
  const reasonChips = (reasons && reasons.length)
    ? `<div class="flex flex-wrap gap-1.5 mb-4">${reasons.slice(0, 4).map((rs) => `<span class="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[11px] font-bold text-gray-500">${escapeHtml(REASON_KO[rs] || APPROACH_KO[rs] || SPECIALTY_KO[rs] || rs)}</span>`).join('')}</div>`
    : '';
  const price = c.price ? `${Number(c.price).toLocaleString('ko-KR')}원` : '상담료 문의';
  const rating = c.rating != null ? `<span class="inline-flex items-center gap-1 text-[12px] font-bold text-amber-500"><i class="ph-fill ph-star"></i>${escapeHtml(String(c.rating))}</span>` : '';
  return `<div data-action="OPEN_COUNSELOR_DETAIL" data-counselor-id="${escapeAttr(c.id)}" class="bg-white rounded-[24px] p-6 border border-gray-100 shadow-sm hover:shadow-float transition-all group flex flex-col h-full cursor-pointer">
    <div class="flex items-start justify-between mb-4">
      <span class="inline-block px-3 py-1.5 rounded-full text-[11px] font-bold border ${tag}">${escapeHtml(spec)}</span>
      ${scoreBadge || rating}
    </div>
    <div class="flex items-center gap-4 mb-4">
      <div class="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-xl border-2 border-gray-50 shadow-sm shrink-0">${escapeHtml(initials)}</div>
      <div>
        <h3 class="text-[17px] font-bold text-gray-900 font-display group-hover:text-primary transition-colors">${escapeHtml(c.displayName || '상담사')}</h3>
        <p class="text-[13px] text-gray-500 font-medium">${escapeHtml(REGION_KO[c.region] || c.region || '')} · ${escapeHtml(appr || '정서 케어')}</p>
      </div>
    </div>
    <p class="text-[13px] text-gray-500 leading-relaxed mb-4 line-clamp-3 flex-1">${escapeHtml(c.bio || '')}</p>
    ${reasonChips}
    <div class="flex items-center gap-1.5 text-[13px] mb-4 bg-gray-50 px-3 py-2 rounded-xl w-fit text-gray-600 font-medium"><i class="ph-fill ph-calendar-dots text-primary"></i> 가능 요일 ${escapeHtml(days || '-')}</div>
    <div class="pt-4 border-t border-gray-100 flex items-center justify-between mt-auto">
      <span class="text-[14px] font-bold text-primary">${escapeHtml(price)}</span>
      <button data-action="OPEN_BOOKING" data-counselor-id="${escapeAttr(c.id)}" class="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-[13px] font-bold transition-colors shadow-sm">상담 신청</button>
    </div>
  </div>`;
}

/* ---------------------------------------------------- counselor detail */
async function openCounselorDetail(counselorId) {
  if (!counselorId) return;
  state.bookingCounselor = null;
  openModal('counselor-detail');
  const wrap = $bind('counselor-detail-body');
  if (wrap) wrap.innerHTML = `<div class="p-10 text-center text-gray-400 text-[14px]">상담사 정보를 불러오는 중…</div>`;
  try {
    const c = await api(`/v1/counselors/${encodeURIComponent(counselorId)}`, { auth: false });
    renderCounselorDetail(c);
  } catch (err) {
    const cached = counselorById(counselorId);
    if (cached) { renderCounselorDetail(cached); return; }
    if (wrap) wrap.innerHTML = `<div class="p-10 text-center text-gray-400 text-[14px]">${escapeHtml(err.message || '상담사 정보를 불러오지 못했어요.')}</div>`;
  }
}

function renderCounselorDetail(c) {
  const wrap = $bind('counselor-detail-body');
  if (!wrap) return;
  const initials = (c.displayName || '상')[0];
  const spec = (c.specialties || []).map((s) => SPECIALTY_KO[s] || s).join(' · ') || '정서 케어';
  const appr = (c.approach || []).map((a) => APPROACH_KO[a] || a).join(' · ') || '-';
  const langs = (c.languages || []).map((l) => (l === 'ko' ? '한국어' : l === 'en' ? '영어' : l)).join(', ') || '한국어';
  const price = c.price ? `${Number(c.price).toLocaleString('ko-KR')}원` : '상담료 문의';
  const availRows = Object.entries(c.availability || {}).map(([d, times]) =>
    `<div class="flex items-center gap-2 text-[13px]"><span class="w-8 font-bold text-gray-700">${DAY_KO[d] || d}</span><span class="text-gray-500">${(times || []).map(escapeHtml).join(', ') || '-'}</span></div>`).join('') || '<span class="text-[13px] text-gray-400">예약 가능 시간 정보가 없습니다.</span>';
  wrap.innerHTML = `
    <div class="flex items-center gap-4 mb-5">
      <div class="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-2xl shadow-md shrink-0">${escapeHtml(initials)}</div>
      <div>
        <h2 class="text-2xl font-bold text-gray-900 font-display">${escapeHtml(c.displayName || '상담사')}</h2>
        <p class="text-[14px] text-gray-500 font-medium mt-0.5">${escapeHtml(REGION_KO[c.region] || c.region || '')} · 경력 ${escapeHtml(String(c.years ?? '-'))}년</p>
        <div class="flex items-center gap-3 mt-1.5 text-[13px]">
          <span class="inline-flex items-center gap-1 font-bold text-amber-500"><i class="ph-fill ph-star"></i>${escapeHtml(String(c.rating ?? '-'))}</span>
          <span class="font-bold text-primary">${escapeHtml(price)}</span>
        </div>
      </div>
    </div>
    <p class="text-[14px] text-gray-700 leading-relaxed mb-5">${escapeHtml(c.bio || '')}</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
      <div class="bg-gray-50 rounded-2xl p-4"><p class="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">전문 분야</p><p class="text-[14px] font-bold text-gray-800">${escapeHtml(spec)}</p></div>
      <div class="bg-gray-50 rounded-2xl p-4"><p class="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">상담 방식</p><p class="text-[14px] font-bold text-gray-800">${escapeHtml(appr)}</p></div>
      <div class="bg-gray-50 rounded-2xl p-4"><p class="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">사용 언어</p><p class="text-[14px] font-bold text-gray-800">${escapeHtml(langs)}</p></div>
      <div class="bg-gray-50 rounded-2xl p-4"><p class="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2">예약 가능</p><div class="space-y-1">${availRows}</div></div>
    </div>
    <button data-action="OPEN_BOOKING" data-counselor-id="${escapeAttr(c.id)}" class="w-full py-3.5 bg-gradient-to-r from-primary to-secondary text-white rounded-2xl font-bold text-[15px] shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"><i class="ph-bold ph-calendar-plus text-lg"></i> 상담 신청하기</button>`;
}

async function runMatching() {
  if (state.view !== 'find-expert') changeView('find-expert');
  if (!state.checkin.result || !state.checkin.result.values) {
    toast('먼저 마음 체크인을 완료하면 더 정확히 매칭돼요.');
    openChat(true);
    return;
  }
  const banner = $bind('match-banner');
  try {
    const r = state.checkin.result;
    const data = await api('/v1/matching', { method: 'POST', body: { checkinResult: { type: r.type, values: r.values }, goal: r.values.goal, limit: 3 }, auth: false });
    state.matches = Array.isArray(data.items) ? data.items : [];
    state.matchActive = true;
    if (banner) {
      banner.classList.remove('hidden');
      banner.innerHTML = `<div class="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/15 rounded-2xl px-5 py-4 flex items-center gap-3">
        <i class="ph-fill ph-magic-wand text-primary text-xl"></i>
        <div class="flex-1"><p class="text-[14px] font-bold text-gray-900">체크인 결과 기반 추천</p><p class="text-[13px] text-gray-500">${escapeHtml(r.summaryLine || '')}</p></div>
        <button data-action="RUN_MATCHING" class="text-[12px] font-bold text-primary hover:underline">새로고침</button>
      </div>`;
    }
    renderCounselors();
    toast('체크인 결과로 상담사를 추천했어요.');
  } catch (err) {
    toast(err.message || '매칭에 실패했어요.');
  }
}

function mergeAdminCounselors(list) {
  for (const c of list) {
    const i = state.adminCounselors.findIndex((x) => x.id === c.id);
    if (i >= 0) state.adminCounselors[i] = { ...state.adminCounselors[i], ...c };
    else state.adminCounselors.push(c);
  }
  saveJSON(LS.adminCounselors, state.adminCounselors);
}

const C_STATUS_KO = {
  active: { label: '활동 중', dot: 'bg-emerald-500', cls: 'text-emerald-600' },
  pending: { label: '승인 대기', dot: 'bg-amber-500', cls: 'text-amber-600' },
  inactive: { label: '휴면', dot: 'bg-gray-400', cls: 'text-gray-500' },
};

function adminCounselorList() {
  let rows = state.adminCounselors.slice();
  const q = state.adminCounselorQuery.trim().toLowerCase();
  if (q) rows = rows.filter((c) => (c.displayName || '').toLowerCase().includes(q) || (c.id || '').toLowerCase().includes(q) || (c.specialties || []).some((s) => (SPECIALTY_KO[s] || s).toLowerCase().includes(q)));
  if (state.adminCounselorStatus) rows = rows.filter((c) => (c.status || 'active') === state.adminCounselorStatus);
  // active first, then pending, then inactive; stable by name
  const order = { active: 0, pending: 1, inactive: 2 };
  rows.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || (a.displayName || '').localeCompare(b.displayName || ''));
  return rows;
}

function renderAdminCounselors() {
  const tbody = $bind('admin-counselor-rows');
  if (!tbody) return;
  const rows = adminCounselorList();
  const countEl = $bind('admin-counselor-count');
  if (countEl) countEl.textContent = `${state.adminCounselors.length}명`;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-gray-400 text-[14px]">표시할 상담사가 없습니다. <button data-action="OPEN_COUNSELOR_FORM" class="text-primary font-bold hover:underline ml-1">신규 등록</button>으로 추가하세요.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((c) => {
    const spec = (c.specialties || []).slice(0, 2).map((s) => SPECIALTY_KO[s] || s).join(', ') || '정서 케어';
    const days = Object.keys(c.availability || {}).map((d) => DAY_KO[d] || d).join('·');
    const st = C_STATUS_KO[c.status] || C_STATUS_KO.active;
    const isActive = (c.status || 'active') === 'active';
    return `<tr class="hover:bg-gray-50/50 transition-colors group">
      <td class="px-6 py-4"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold border border-gray-200">${escapeHtml((c.displayName || '상')[0])}</div><div><div class="font-bold text-gray-900">${escapeHtml(c.displayName || '')}</div><div class="text-gray-500 text-[12px]">${escapeHtml(REGION_KO[c.region] || c.region || '')} · ${escapeHtml(c.id)}</div></div></div></td>
      <td class="px-6 py-4"><span class="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-[12px] font-bold border border-blue-100">${escapeHtml(spec)}</span></td>
      <td class="px-6 py-4"><div class="font-bold text-gray-900">가능 ${escapeHtml(days || '-')}</div><div class="text-amber-500 text-[12px] font-bold flex items-center gap-1 mt-0.5"><i class="ph-fill ph-star"></i> ${escapeHtml(String(c.rating ?? '-'))} · 경력 ${escapeHtml(String(c.years ?? '-'))}년</div></td>
      <td class="px-6 py-4"><span class="flex items-center gap-1.5 ${st.cls} font-bold text-[13px]"><span class="w-2 h-2 rounded-full ${st.dot}"></span> ${st.label}</span></td>
      <td class="px-6 py-4 text-right">
        <div class="flex items-center justify-end gap-2">
          ${!isActive ? `<button data-action="APPROVE_COUNSELOR" data-counselor-id="${escapeAttr(c.id)}" class="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-[12px] font-bold transition-colors">승인</button>` : `<button data-action="DEACTIVATE_COUNSELOR" data-counselor-id="${escapeAttr(c.id)}" class="px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg text-[12px] font-bold transition-colors">휴면</button>`}
          <button data-action="OPEN_COUNSELOR_FORM" data-counselor-id="${escapeAttr(c.id)}" class="px-3 py-1.5 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg text-[12px] font-bold transition-colors">수정</button>
          <button data-action="DELETE_COUNSELOR" data-counselor-id="${escapeAttr(c.id)}" class="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-[12px] font-bold transition-colors">삭제</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ----------------------------------------------- admin counselor CRUD */
function counselorFormValues() {
  const get = (k) => $(`[data-input="${k}"]`)?.value?.trim() || '';
  const csv = (k) => get(k).split(',').map((s) => s.trim()).filter(Boolean);
  // availability: comma-separated "mon:10:00,mon:14:00,thu:09:00"
  const availability = {};
  csv('cform-availability').forEach((pair) => {
    const idx = pair.indexOf(':');
    if (idx < 0) return;
    const day = pair.slice(0, idx).trim();
    const time = pair.slice(idx + 1).trim();
    if (!FILTER_DAYS.includes(day) || !time) return;
    (availability[day] = availability[day] || []).push(time);
  });
  return {
    displayName: get('cform-name'),
    specialties: csv('cform-specialties'),
    approach: csv('cform-approach'),
    region: get('cform-region') || 'seoul',
    languages: csv('cform-languages').length ? csv('cform-languages') : ['ko'],
    availability,
    rating: Number(get('cform-rating') || 4.5),
    years: Number(get('cform-years') || 1),
    price: Number(get('cform-price') || 60000),
    bio: get('cform-bio'),
    profileImage: get('cform-image'),
    status: $('[data-input="cform-status"]')?.value || 'active',
  };
}

function openCounselorForm(counselorId) {
  if (!isAdmin()) { toast('관리자 권한이 필요합니다.'); return; }
  state.editingCounselorId = counselorId || null;
  const c = counselorId ? counselorById(counselorId) : null;
  renderCounselorFormOptions();
  const set = (k, v) => { const el = $(`[data-input="${k}"]`); if (el) el.value = v; };
  set('cform-name', c?.displayName || '');
  set('cform-specialties', (c?.specialties || []).join(', '));
  set('cform-approach', (c?.approach || []).join(', '));
  set('cform-region', c?.region || 'seoul');
  set('cform-languages', (c?.languages || ['ko']).join(', '));
  set('cform-availability', Object.entries(c?.availability || { mon: ['10:00'] }).flatMap(([d, ts]) => (ts || []).map((t) => `${d}:${t}`)).join(', '));
  set('cform-rating', c?.rating ?? 4.5);
  set('cform-years', c?.years ?? 1);
  set('cform-price', c?.price ?? 60000);
  set('cform-bio', c?.bio || '');
  set('cform-image', c?.profileImage || '');
  set('cform-status', c?.status || 'active');
  const title = $bind('counselor-form-title');
  if (title) title.textContent = counselorId ? '상담사 수정' : '상담사 신규 등록';
  hideError('counselor-form-error');
  openModal('counselor-form');
}

function renderCounselorFormOptions() {
  const region = $('[data-input="cform-region"]');
  if (region && !region.options.length) region.innerHTML = FILTER_REGIONS.map((r) => `<option value="${r}">${REGION_KO[r]}</option>`).join('');
  const status = $('[data-input="cform-status"]');
  if (status && !status.options.length) status.innerHTML = `<option value="active">활동 중</option><option value="pending">승인 대기</option><option value="inactive">휴면</option>`;
  const specHint = $bind('cform-specialty-hint');
  if (specHint) specHint.textContent = FILTER_SPECIALTIES.map((s) => SPECIALTY_KO[s]).join(', ');
  const apprHint = $bind('cform-approach-hint');
  if (apprHint) apprHint.textContent = FILTER_APPROACHES.map((a) => APPROACH_KO[a]).join(', ');
}

async function submitCounselor() {
  if (!isAdmin()) { showError('counselor-form-error', '관리자 권한이 필요합니다.'); return; }
  const body = counselorFormValues();
  if (!body.displayName) return showError('counselor-form-error', '상담사 이름을 입력해주세요.');
  if (!body.specialties.length) return showError('counselor-form-error', '전문 분야를 1개 이상 입력해주세요. (예: relationship)');
  const btn = $('[data-action="SUBMIT_COUNSELOR"]');
  if (btn) { btn.disabled = true; btn.textContent = '저장 중…'; }
  try {
    const editing = state.editingCounselorId;
    const data = editing
      ? await api(`/v1/counselors/${encodeURIComponent(editing)}`, { method: 'PATCH', body })
      : await api('/v1/counselors', { method: 'POST', body });
    mergeAdminCounselors([data]);
    closeModal();
    toast(editing ? '상담사 정보를 수정했어요.' : '상담사를 등록했어요.');
    if (state.view === 'admin-counselors') loadCounselors();
    renderAdminCounselors();
  } catch (err) {
    showError('counselor-form-error', err.message || '저장에 실패했어요.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '저장하기'; }
  }
}

async function updateCounselorStatus(counselorId, status) {
  if (!isAdmin()) { toast('관리자 권한이 필요합니다.'); return; }
  try {
    const data = await api(`/v1/counselors/${encodeURIComponent(counselorId)}`, { method: 'PATCH', body: { status } });
    mergeAdminCounselors([data]);
    toast(status === 'active' ? '상담사를 승인(활동중)했어요.' : '상담사를 휴면 처리했어요.');
    loadCounselors();
    renderAdminCounselors();
  } catch (err) {
    toast(err.message || '상태 변경에 실패했어요.');
  }
}

async function deleteCounselor(counselorId) {
  if (!isAdmin()) { toast('관리자 권한이 필요합니다.'); return; }
  const c = counselorById(counselorId);
  if (!window.confirm(`${c?.displayName || '이 상담사'}를 삭제할까요? 되돌릴 수 없습니다.`)) return;
  try {
    await api(`/v1/counselors/${encodeURIComponent(counselorId)}`, { method: 'DELETE' });
    state.adminCounselors = state.adminCounselors.filter((x) => x.id !== counselorId);
    saveJSON(LS.adminCounselors, state.adminCounselors);
    toast('상담사를 삭제했어요.');
    loadCounselors();
    renderAdminCounselors();
  } catch (err) {
    toast(err.message || '삭제에 실패했어요.');
  }
}

function exportCounselorsCsv() {
  const rows = adminCounselorList();
  if (!rows.length) { toast('내보낼 상담사가 없어요.'); return; }
  const header = ['id', 'displayName', 'region', 'specialties', 'approach', 'rating', 'years', 'price', 'status'];
  const lines = [header.join(',')].concat(rows.map((c) => [
    c.id, c.displayName, c.region, (c.specialties || []).join('|'), (c.approach || []).join('|'),
    c.rating, c.years, c.price, c.status,
  ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')));
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'carebridge-counselors.csv';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('상담사 목록을 CSV로 내려받았어요.');
}

function renderDocumentCounselorOptions() {
  const opts = `<option value="">상담사 선택</option>` + state.adminCounselors
    .slice().sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
    .map((c) => `<option value="${escapeAttr(c.id)}">${escapeHtml(c.displayName || c.id)}</option>`).join('');
  ['doc-counselor', 'record-counselor'].forEach((k) => { const el = $(`[data-input="${k}"]`); if (el) el.innerHTML = opts; });
}

/* ----------------------------------------------------------------- booking */
function openBooking(counselorId) {
  if (!requireAuth('상담 신청은 로그인 후 가능해요.')) return;
  const c = counselorById(counselorId);
  if (!c) return;
  closeModal();
  state.bookingCounselor = c;
  const nameEl = $bind('booking-counselor'); if (nameEl) nameEl.textContent = c.displayName || '상담사';
  const times = new Set();
  Object.values(c.availability || {}).forEach((arr) => (arr || []).forEach((t) => times.add(t)));
  const timeSel = $('[data-input="booking-time"]');
  if (timeSel) timeSel.innerHTML = [...times].sort().map((t) => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join('') || '<option value="10:00">10:00</option>';
  const days = Object.keys(c.availability || {}).map((d) => DAY_KO[d] || d).join('·');
  const availEl = $bind('booking-avail'); if (availEl) availEl.textContent = `가능 요일: ${days || '-'}`;
  const dateEl = $('[data-input="booking-date"]');
  if (dateEl) { const d = new Date(); d.setDate(d.getDate() + 3); dateEl.value = d.toISOString().slice(0, 10); }
  const memoEl = $('[data-input="booking-memo"]'); if (memoEl) memoEl.value = '';
  hideError('booking-error');
  openModal('booking');
}

async function submitBooking() {
  const c = state.bookingCounselor;
  if (!c) return;
  const date = $('[data-input="booking-date"]')?.value;
  const time = $('[data-input="booking-time"]')?.value || '10:00';
  const memo = $('[data-input="booking-memo"]')?.value || '';
  if (!date) return showError('booking-error', '희망 날짜를 선택해주세요.');
  const startsAt = `${date}T${time}:00+09:00`;
  const btn = $('[data-action="SUBMIT_BOOKING"]');
  if (btn) { btn.disabled = true; btn.textContent = '신청 중…'; }
  try {
    const data = await api('/v1/bookings', { method: 'POST', body: { counselorId: c.id, startsAt, memo } });
    state.bookings.unshift(data);
    saveJSON(LS.bookings, state.bookings);
    closeModal();
    toast(`${data.counselorDisplayName || c.displayName}님께 상담을 신청했어요.`);
  } catch (err) {
    showError('booking-error', err.message || '상담 신청에 실패했어요.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '신청하기'; }
  }
}

function openBookings() {
  if (!requireAuth()) return;
  openModal('bookings');
  loadBookings();
}

async function loadBookings() {
  const list = $bind('bookings-list');
  if (list) list.innerHTML = `<div class="text-center text-gray-400 py-8 text-[14px]">불러오는 중…</div>`;
  try {
    const data = await api('/v1/bookings?limit=50&offset=0');
    state.bookings = Array.isArray(data.items) ? data.items : [];
    saveJSON(LS.bookings, state.bookings);
  } catch (err) {
    // fall back to locally cached bookings if the list call fails
    console.warn('[carebridge] bookings load failed', err);
  }
  renderBookings();
}

async function bookingTransition(bookingId, status) {
  const b = state.bookings.find((x) => x.id === bookingId);
  try {
    const data = await api(`/v1/bookings/${encodeURIComponent(bookingId)}/transition`, { method: 'POST', body: { status } });
    if (b) Object.assign(b, data);
    saveJSON(LS.bookings, state.bookings);
    renderBookings();
    const label = STATUS_KO[status]?.label || status;
    toast(`상담을 ${label} 처리했어요.`);
  } catch (err) {
    toast(err.message || '상태 변경에 실패했어요.');
  }
}

const STATUS_KO = {
  requested: { label: '신청됨', cls: 'text-amber-600 bg-amber-50 border-amber-100' },
  confirmed: { label: '확정됨', cls: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  cancelled: { label: '취소됨', cls: 'text-gray-500 bg-gray-50 border-gray-200' },
  done: { label: '완료', cls: 'text-blue-600 bg-blue-50 border-blue-100' },
};

function renderBookings() {
  const list = $bind('bookings-list');
  if (!list) return;
  const admin = isAdmin();
  const rows = admin ? state.bookings : state.bookings.filter((b) => !state.auth?.account?.id || b.accountId === state.auth.account.id);
  const sub = $bind('bookings-subtitle');
  if (sub) sub.textContent = admin ? '플랫폼 전체 상담 신청을 관리합니다.' : '신청한 상담의 진행 상태를 확인하세요.';
  if (!rows.length) { list.innerHTML = `<div class="text-center text-gray-400 py-10 text-[14px]">${admin ? '접수된 상담 신청이 없어요.' : '아직 신청한 상담이 없어요.<br/>전문가 찾기에서 상담을 신청해보세요.'}</div>`; return; }
  const canManage = admin || role() === 'counselor';
  list.innerHTML = rows.map((b) => {
    const st = STATUS_KO[b.status] || STATUS_KO.requested;
    const when = (b.startsAt || '').replace('T', ' ').slice(0, 16);
    const actions = [];
    if (canManage && b.status === 'requested') actions.push(`<button data-action="BOOKING_TRANSITION" data-booking-id="${escapeAttr(b.id)}" data-status="confirmed" class="text-[13px] font-bold text-emerald-600 hover:text-emerald-700">확정</button>`);
    if (canManage && b.status === 'confirmed') actions.push(`<button data-action="BOOKING_TRANSITION" data-booking-id="${escapeAttr(b.id)}" data-status="done" class="text-[13px] font-bold text-blue-600 hover:text-blue-700">완료</button>`);
    if (b.status === 'requested' || b.status === 'confirmed') actions.push(`<button data-action="BOOKING_TRANSITION" data-booking-id="${escapeAttr(b.id)}" data-status="cancelled" class="text-[13px] font-bold text-red-500 hover:text-red-700">취소</button>`);
    return `<div class="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div class="flex justify-between items-start mb-2">
        <h3 class="font-bold text-gray-900 text-[16px]">${escapeHtml(b.counselorDisplayName || '상담사')}</h3>
        <span class="px-2.5 py-1 rounded-full text-[12px] font-bold border ${st.cls}">${st.label}</span>
      </div>
      <p class="text-[13px] text-gray-500 mb-1"><i class="ph-fill ph-clock text-gray-400"></i> ${escapeHtml(when)}</p>
      ${b.memo ? `<p class="text-[13px] text-gray-500 mb-3">${escapeHtml(b.memo)}</p>` : '<div class="mb-3"></div>'}
      ${actions.length ? `<div class="flex items-center gap-4">${actions.join('')}</div>` : ''}
    </div>`;
  }).join('');
}

async function cancelBooking(bookingId) {
  const b = state.bookings.find((x) => x.id === bookingId);
  if (!b) return;
  try {
    const data = await api(`/v1/bookings/${encodeURIComponent(bookingId)}/transition`, { method: 'POST', body: { status: 'cancelled' } });
    Object.assign(b, data);
    saveJSON(LS.bookings, state.bookings);
    renderBookings();
    toast('상담 신청을 취소했어요.');
  } catch (err) {
    toast(err.message || '취소에 실패했어요.');
  }
}

/* --------------------------------------------------------------- documents */
async function loadDocuments() {
  const list = $bind('documents-list');
  if (list) list.innerHTML = `<div class="p-8 text-center text-gray-400 text-[14px]">불러오는 중…</div>`;
  try {
    const params = new URLSearchParams({ limit: '50', offset: '0' });
    if (state.documentsFilter.type) params.set('type', state.documentsFilter.type);
    if (state.documentsFilter.counselorId) params.set('counselorId', state.documentsFilter.counselorId);
    if (state.documentsFilter.clientRef) params.set('clientRef', state.documentsFilter.clientRef);
    const data = await api(`/v1/documents?${params.toString()}`);
    state.documents = Array.isArray(data.items) ? data.items : [];
    state.documentsLoaded = true;
    renderDocuments();
  } catch (err) {
    if (list) list.innerHTML = `<div class="p-8 text-center text-gray-400 text-[14px]">${escapeHtml(err.message || '문서를 불러오지 못했어요.')}</div>`;
  }
}

function counselorName(id, fallbackName) {
  const c = counselorById(id);
  if (c && c.displayName) return c.displayName;
  if (fallbackName) return fallbackName;
  if (!id) return '-';
  // Opaque generated ids (e.g. "counselor_z93p..." or "counselor-seed-01") must never surface to staff.
  if (/^counselor[_-]/i.test(id)) return '(삭제된 상담사)';
  return id;
}

function renderDocuments() {
  const list = $bind('documents-list');
  const countEl = $bind('documents-count');
  if (countEl) countEl.textContent = `${state.documents.length}건`;
  if (!list) return;
  if (!state.documents.length) { list.innerHTML = `<div class="p-10 text-center text-gray-400 text-[14px]">아직 등록된 상담 문서가 없어요.<br/>왼쪽 양식으로 첫 문서를 등록해보세요.</div>`; return; }
  list.innerHTML = state.documents.map((d) => {
    const tags = (d.tags || []).map((t) => `<span class="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[11px] font-bold text-gray-500">${escapeHtml(t)}</span>`).join(' ');
    return `<div data-action="OPEN_DOCUMENT" data-doc-id="${escapeAttr(d.id)}" class="p-5 hover:bg-gray-50/80 transition-colors cursor-pointer">
      <div class="flex items-start justify-between gap-3 mb-1.5">
        <h4 class="font-bold text-gray-900 text-[15px] line-clamp-1">${escapeHtml(d.title || '제목 없음')}</h4>
        <div class="shrink-0 flex items-center gap-2">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">${escapeHtml(DOC_TYPE_KO[d.type] || d.type || '문서')}</span>
          <button data-action="DELETE_DOCUMENT" data-doc-id="${escapeAttr(d.id)}" class="shrink-0 px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-[11px] font-bold transition-colors">삭제</button>
        </div>
      </div>
      <p class="text-[13px] text-gray-500 mb-2">담당 ${escapeHtml(counselorName(d.counselorId, d.counselorDisplayName))} · 내담자 ${escapeHtml(d.clientRef || '-')}</p>
      <p class="text-[13px] text-gray-500 line-clamp-2 leading-relaxed mb-2">${escapeHtml(d.body || '')}</p>
      <div class="flex items-center gap-1.5 flex-wrap">${tags}</div>
    </div>`;
  }).join('');
}

function docFormValues() {
  const get = (k) => $(`[data-input="${k}"]`)?.value?.trim() || '';
  return {
    title: get('doc-title'),
    type: $('[data-input="doc-type"]')?.value || 'intake',
    counselorId: $('[data-input="doc-counselor"]')?.value || '',
    clientRef: get('doc-client'),
    body: get('doc-body'),
    url: get('doc-url'),
    tags: get('doc-tags').split(',').map((s) => s.trim()).filter(Boolean),
  };
}

async function submitDocument() {
  if (!canManageDocs()) { showError('doc-error', '상담사 또는 관리자 권한이 필요합니다.'); return; }
  const body = docFormValues();
  if (!body.title) return showError('doc-error', '문서 제목을 입력해주세요.');
  if (!body.counselorId) return showError('doc-error', '담당 상담사를 선택해주세요.');
  if (!body.clientRef) return showError('doc-error', '내담자 식별자를 입력해주세요.');
  const btn = $('[data-action="SUBMIT_DOCUMENT"]');
  if (btn) { btn.disabled = true; btn.textContent = '등록 중…'; }
  try {
    await api('/v1/documents', { method: 'POST', body });
    toast('상담 문서를 등록했어요.');
    resetDocumentForm();
    loadDocuments();
  } catch (err) {
    showError('doc-error', err.message || '문서 등록에 실패했어요.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '최종 등록'; }
  }
}

async function deleteDocument(docId) {
  if (!docId) return;
  if (!canManageDocs()) { toast('상담사 또는 관리자 권한이 필요합니다.'); return; }
  if (!window.confirm('이 상담 문서를 삭제할까요? 되돌릴 수 없습니다.')) return;
  try {
    await api(`/v1/documents/${encodeURIComponent(docId)}`, { method: 'DELETE' });
    toast('상담 문서를 삭제했어요.');
    loadDocuments();
  } catch (err) {
    toast(err.message || '문서 삭제에 실패했어요.');
  }
}

function resetDocumentForm() {
  ['doc-title', 'doc-client', 'doc-body', 'doc-url', 'doc-tags'].forEach((k) => { const el = $(`[data-input="${k}"]`); if (el) el.value = ''; });
  const type = $('[data-input="doc-type"]'); if (type) type.value = 'intake';
  hideError('doc-error');
}

async function openDocument(docId) {
  const local = state.documents.find((d) => d.id === docId);
  try {
    const d = local || await api(`/v1/documents/${encodeURIComponent(docId)}`);
    const tags = (d.tags || []).join(', ');
    const created = (d.createdAt || '').replace('T', ' ').slice(0, 16);
    alertModal('상담 문서', `
      <div class="space-y-3">
        <div><span class="text-[12px] font-bold text-gray-400 uppercase">제목</span><p class="text-[15px] font-bold text-gray-900">${escapeHtml(d.title || '')}</p></div>
        <div class="grid grid-cols-2 gap-3">
          <div><span class="text-[12px] font-bold text-gray-400 uppercase">분류</span><p class="text-[14px] text-gray-800">${escapeHtml(DOC_TYPE_KO[d.type] || d.type || '')}</p></div>
          <div><span class="text-[12px] font-bold text-gray-400 uppercase">담당 상담사</span><p class="text-[14px] text-gray-800">${escapeHtml(counselorName(d.counselorId, d.counselorDisplayName))}</p></div>
          <div><span class="text-[12px] font-bold text-gray-400 uppercase">내담자</span><p class="text-[14px] text-gray-800">${escapeHtml(d.clientRef || '-')}</p></div>
          <div><span class="text-[12px] font-bold text-gray-400 uppercase">등록일</span><p class="text-[14px] text-gray-800">${escapeHtml(created)}</p></div>
        </div>
        <div><span class="text-[12px] font-bold text-gray-400 uppercase">본문</span><p class="text-[14px] text-gray-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(d.body || '')}</p></div>
        ${d.url ? `<div><span class="text-[12px] font-bold text-gray-400 uppercase">참고 링크</span><p class="text-[14px] text-primary break-all">${escapeHtml(d.url)}</p></div>` : ''}
        ${tags ? `<div><span class="text-[12px] font-bold text-gray-400 uppercase">태그</span><p class="text-[14px] text-gray-700">${escapeHtml(tags)}</p></div>` : ''}
      </div>`);
  } catch (err) {
    toast(err.message || '문서를 불러오지 못했어요.');
  }
}

/* ----------------------------------------------------------------- records */
async function loadRecords() {
  const list = $bind('records-list');
  if (list) list.innerHTML = `<div class="col-span-full p-8 text-center text-gray-400 text-[14px]">불러오는 중…</div>`;
  try {
    const params = new URLSearchParams({ limit: '50', offset: '0' });
    if (state.recordsFilter.status) params.set('status', state.recordsFilter.status);
    if (state.recordsFilter.counselorId) params.set('counselorId', state.recordsFilter.counselorId);
    if (state.recordsFilter.clientRef) params.set('clientRef', state.recordsFilter.clientRef);
    if (state.recordsFilter.date) params.set('date', state.recordsFilter.date);
    const data = await api(`/v1/records?${params.toString()}`);
    state.records = Array.isArray(data.items) ? data.items : [];
    state.recordsLoaded = true;
    renderRecords();
  } catch (err) {
    if (list) list.innerHTML = `<div class="col-span-full p-8 text-center text-gray-400 text-[14px]">${escapeHtml(err.message || '상담 기록을 불러오지 못했어요.')}</div>`;
  }
}

const REC_STATUS_CLS = {
  scheduled: 'text-blue-600 bg-blue-50 border-blue-100',
  in_progress: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  completed: 'text-gray-600 bg-gray-50 border-gray-200',
  cancelled: 'text-red-500 bg-red-50 border-red-100',
  followup: 'text-amber-600 bg-amber-50 border-amber-100',
};

function renderRecords() {
  const list = $bind('records-list');
  const countEl = $bind('records-count');
  if (countEl) countEl.textContent = `${state.records.length}건`;
  if (!list) return;
  if (!state.records.length) { list.innerHTML = `<div class="col-span-full p-10 text-center text-gray-400 text-[14px]">조회된 상담 기록이 없어요.<br/>“새 기록 작성”으로 첫 기록을 만들어보세요.</div>`; return; }
  list.innerHTML = state.records.map((r) => {
    const cls = REC_STATUS_CLS[r.status] || REC_STATUS_CLS.completed;
    return `<div data-action="OPEN_RECORD" data-record-id="${escapeAttr(r.id)}" class="bg-white border border-gray-100 rounded-[24px] p-6 shadow-sm hover:shadow-float transition-all cursor-pointer">
      <div class="flex justify-between items-start mb-4">
        <span class="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-[12px] font-bold">${escapeHtml((r.date || '').slice(0, 10) || '날짜 미정')}</span>
        <div class="shrink-0 flex items-center gap-2">
          <span class="text-[12px] font-bold px-2.5 py-1 rounded-full border ${cls}">${escapeHtml(RECORD_STATUS_KO[r.status] || r.status || '기록')}</span>
          <button data-action="DELETE_RECORD" data-record-id="${escapeAttr(r.id)}" class="shrink-0 px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-[11px] font-bold transition-colors">삭제</button>
        </div>
      </div>
      <h3 class="font-bold text-gray-900 text-[16px] mb-1">내담자 ${escapeHtml(r.clientRef || '-')}</h3>
      <p class="text-gray-500 text-[13px] mb-3">담당: ${escapeHtml(counselorName(r.counselorId, r.counselorDisplayName))}</p>
      <p class="text-gray-600 text-[13px] leading-relaxed line-clamp-2">${escapeHtml(r.summary || '')}</p>
    </div>`;
  }).join('');
}

function openRecordForm() {
  if (!canManageDocs()) { toast('상담사 또는 관리자 권한이 필요합니다.'); return; }
  renderDocumentCounselorOptions();
  const status = $('[data-input="record-status"]');
  if (status && !status.options.length) status.innerHTML = Object.entries(RECORD_STATUS_KO).map(([v, k]) => `<option value="${v}">${k}</option>`).join('');
  ['record-client', 'record-summary', 'record-followup'].forEach((k) => { const el = $(`[data-input="${k}"]`); if (el) el.value = ''; });
  const dateEl = $('[data-input="record-date"]'); if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
  if (status) status.value = 'completed';
  hideError('record-error');
  openModal('record-form');
}

async function submitRecord() {
  if (!canManageDocs()) { showError('record-error', '상담사 또는 관리자 권한이 필요합니다.'); return; }
  const get = (k) => $(`[data-input="${k}"]`)?.value?.trim() || '';
  const body = {
    clientRef: get('record-client'),
    counselorId: $('[data-input="record-counselor"]')?.value || '',
    date: get('record-date'),
    summary: get('record-summary'),
    status: $('[data-input="record-status"]')?.value || 'completed',
    followUp: get('record-followup'),
  };
  if (!body.clientRef) return showError('record-error', '내담자 식별자를 입력해주세요.');
  if (!body.counselorId) return showError('record-error', '담당 상담사를 선택해주세요.');
  if (!body.summary) return showError('record-error', '상담 요약을 입력해주세요.');
  const btn = $('[data-action="SUBMIT_RECORD"]');
  if (btn) { btn.disabled = true; btn.textContent = '저장 중…'; }
  try {
    await api('/v1/records', { method: 'POST', body });
    closeModal();
    toast('상담 기록을 저장했어요.');
    loadRecords();
  } catch (err) {
    showError('record-error', err.message || '기록 저장에 실패했어요.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '저장하기'; }
  }
}

async function deleteRecord(recordId) {
  if (!recordId) return;
  if (!canManageDocs()) { toast('상담사 또는 관리자 권한이 필요합니다.'); return; }
  if (!window.confirm('이 상담 기록을 삭제할까요? 되돌릴 수 없습니다.')) return;
  try {
    await api(`/v1/records/${encodeURIComponent(recordId)}`, { method: 'DELETE' });
    toast('상담 기록을 삭제했어요.');
    loadRecords();
  } catch (err) {
    toast(err.message || '기록 삭제에 실패했어요.');
  }
}

async function openRecord(recordId) {
  const local = state.records.find((r) => r.id === recordId);
  try {
    const r = local || await api(`/v1/records/${encodeURIComponent(recordId)}`);
    const created = (r.createdAt || '').replace('T', ' ').slice(0, 16);
    alertModal('상담 기록', `
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div><span class="text-[12px] font-bold text-gray-400 uppercase">상담 일자</span><p class="text-[14px] text-gray-800">${escapeHtml((r.date || '').slice(0, 10))}</p></div>
          <div><span class="text-[12px] font-bold text-gray-400 uppercase">상태</span><p class="text-[14px] text-gray-800">${escapeHtml(RECORD_STATUS_KO[r.status] || r.status || '')}</p></div>
          <div><span class="text-[12px] font-bold text-gray-400 uppercase">내담자</span><p class="text-[14px] text-gray-800">${escapeHtml(r.clientRef || '-')}</p></div>
          <div><span class="text-[12px] font-bold text-gray-400 uppercase">담당 상담사</span><p class="text-[14px] text-gray-800">${escapeHtml(counselorName(r.counselorId, r.counselorDisplayName))}</p></div>
        </div>
        <div><span class="text-[12px] font-bold text-gray-400 uppercase">요약</span><p class="text-[14px] text-gray-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(r.summary || '')}</p></div>
        ${r.followUp ? `<div><span class="text-[12px] font-bold text-gray-400 uppercase">후속 계획</span><p class="text-[14px] text-gray-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(r.followUp)}</p></div>` : ''}
        <div><span class="text-[12px] font-bold text-gray-400 uppercase">기록 작성</span><p class="text-[14px] text-gray-800">${escapeHtml(created)}</p></div>
      </div>`);
  } catch (err) {
    toast(err.message || '기록을 불러오지 못했어요.');
  }
}

// Generic read-only detail modal (reuses the post-detail modal shell styling).
function alertModal(title, innerHtml) {
  const wrap = $bind('detail-modal-body');
  if (!wrap) return;
  wrap.innerHTML = `<h2 class="text-2xl font-bold text-gray-900 font-display mb-5 pr-8">${escapeHtml(title)}</h2>${innerHtml}`;
  openModal('detail');
}

/* --------------------------------------------------------------- community */
async function loadCommunity() {
  try {
    if (!state.rooms.length) {
      const data = await api('/v1/community/rooms', { auth: false });
      state.rooms = Array.isArray(data.items) ? data.items : [];
    }
    renderRoomTabs();
    await loadPosts();
  } catch (err) {
    console.warn('[carebridge] community load failed', err);
  }
}

function renderRoomTabs() {
  const tabs = $bind('community-tabs');
  if (!tabs) return;
  const chips = [{ id: 'all', name: '전체' }, ...state.rooms];
  tabs.innerHTML = chips.map((r) => {
    const active = state.activeRoom === r.id;
    return `<button data-action="SET_ROOM" data-room-id="${escapeAttr(r.id)}" class="whitespace-nowrap px-6 py-2.5 rounded-full text-[14px] font-bold transition-all ${active ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900'}">${escapeHtml(r.name)}</button>`;
  }).join('');
}

function setRoom(roomId) {
  state.activeRoom = roomId || 'all';
  renderRoomTabs();
  loadPosts();
}

async function loadPosts() {
  const list = $bind('community-list');
  const pager = $bind('community-pagination');
  if (pager) pager.classList.add('hidden');
  if (list) list.innerHTML = `<div class="p-10 text-center text-gray-400 text-[14px]">불러오는 중…</div>`;
  try {
    const rooms = state.activeRoom === 'all' ? state.rooms : state.rooms.filter((r) => r.id === state.activeRoom);
    const all = [];
    for (const room of rooms) {
      const data = await api(`/v1/community/rooms/${encodeURIComponent(room.id)}/posts?limit=20&offset=0`, { auth: false });
      (data.items || []).forEach((p) => all.push({ ...p, roomName: room.name }));
    }
    all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    state.posts = all;
    state.postsLoaded = true;
    renderPosts();
  } catch (err) {
    if (list) list.innerHTML = `<div class="p-10 text-center text-gray-400 text-[14px]">${escapeHtml(err.message || '글을 불러오지 못했어요.')}</div>`;
  }
}

function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function renderPosts() {
  const list = $bind('community-list');
  if (!list) return;
  if (!state.posts.length) { list.innerHTML = `<div class="p-12 text-center text-gray-400 text-[14px]">아직 글이 없어요. 첫 글을 남겨보세요.</div>`; return; }
  list.innerHTML = state.posts.map((p) => {
    const nick = p.displayName || (p.anonymous ? '익명' : '이용자');
    return `<div data-action="OPEN_POST" data-post-id="${escapeAttr(p.id)}" class="p-6 sm:p-8 hover:bg-gray-50/80 transition-colors cursor-pointer group">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-3 mb-3">
            <span class="inline-block px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-[12px] font-bold whitespace-nowrap">${escapeHtml(p.roomName || '커뮤니티')}</span>
            <h3 class="text-lg sm:text-[19px] font-bold text-gray-900 group-hover:text-primary transition-colors line-clamp-1">${escapeHtml(p.title)}</h3>
          </div>
          <p class="text-[15px] text-gray-500 line-clamp-1 font-medium mb-4 sm:mb-0 pr-0 sm:pr-8">${escapeHtml(p.body)}</p>
        </div>
        <div class="flex items-center justify-between sm:justify-end gap-6 text-[14px] text-gray-400 font-medium shrink-0">
          <div class="flex items-center gap-2"><div class="w-7 h-7 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center font-bold text-[11px] shadow-inner text-white">${escapeHtml(nick[0])}</div><span class="text-gray-600">${escapeHtml(nick)}</span></div>
          <span class="hidden sm:block text-gray-300">•</span>
          <span>${escapeHtml(timeAgo(p.createdAt))}</span>
          <div class="flex items-center gap-4 ml-2 sm:ml-0">
            <span class="flex items-center gap-1.5"><i class="ph-fill ph-heart text-[16px]"></i> ${p.likeCount || 0}</span>
            <span class="flex items-center gap-1.5"><i class="ph-fill ph-chat-circle text-[16px]"></i> ${p.commentCount || 0}</span>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openPostCompose() {
  if (!requireAuth('글쓰기는 로그인 후 가능해요.')) return;
  const sel = $('[data-input="post-room"]');
  if (sel) sel.innerHTML = state.rooms.map((r) => `<option value="${escapeAttr(r.id)}">${escapeHtml(r.name)}</option>`).join('');
  if (sel && state.activeRoom !== 'all') sel.value = state.activeRoom;
  const t = $('[data-input="post-title"]'); if (t) t.value = '';
  const b = $('[data-input="post-body"]'); if (b) b.value = '';
  hideError('post-error');
  openModal('post');
}

async function submitPost() {
  const roomId = $('[data-input="post-room"]')?.value;
  const title = $('[data-input="post-title"]')?.value.trim();
  const body = $('[data-input="post-body"]')?.value.trim();
  const anonymous = $('[data-input="post-anon"]')?.checked ?? true;
  if (!roomId) return showError('post-error', '게시판을 선택해주세요.');
  if (!title || !body) return showError('post-error', '제목과 내용을 입력해주세요.');
  const btn = $('[data-action="SUBMIT_POST"]');
  if (btn) { btn.disabled = true; btn.textContent = '등록 중…'; }
  try {
    await api(`/v1/community/rooms/${encodeURIComponent(roomId)}/posts`, { method: 'POST', body: { title, body, anonymous } });
    closeModal();
    toast('글이 등록되었어요.');
    state.activeRoom = roomId;
    renderRoomTabs();
    await loadPosts();
  } catch (err) {
    showError('post-error', err.message || '등록에 실패했어요.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '등록하기'; }
  }
}

async function openPost(postId) {
  const p = state.posts.find((x) => x.id === postId);
  if (!p) return;
  state.activePost = p;
  openModal('post-detail');
  renderPostDetail();
  try {
    const data = await api(`/v1/community/posts/${encodeURIComponent(postId)}/comments?limit=50&offset=0`, { auth: false });
    state.comments[postId] = Array.isArray(data.items) ? data.items : [];
    renderPostDetail();
  } catch (err) {
    toast(err.message || '댓글을 불러오지 못했어요.');
  }
}

function renderPostDetail() {
  const wrap = $bind('post-detail-body');
  const p = state.activePost;
  if (!wrap || !p) return;
  const nick = p.displayName || (p.anonymous ? '익명' : '이용자');
  const comments = state.comments[p.id] || [];
  const commentsHtml = comments.length
    ? comments.map((cm) => `<div class="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
        <div class="flex items-center gap-2 mb-1"><div class="w-6 h-6 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-white text-[10px] font-bold">${escapeHtml((cm.displayName || '익')[0])}</div><span class="text-[12px] font-bold text-gray-600">${escapeHtml(cm.displayName || '익명')}</span><span class="text-[11px] text-gray-400">${escapeHtml(timeAgo(cm.createdAt))}</span></div>
        <p class="text-[14px] text-gray-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(cm.body)}</p>
      </div>`).join('')
    : `<p class="text-[13px] text-gray-400 text-center py-3">첫 댓글을 남겨보세요.</p>`;
  const totalComments = Math.max(p.commentCount || 0, comments.length);
  wrap.innerHTML = `
    <div class="mb-2"><span class="inline-block px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-[12px] font-bold">${escapeHtml(p.roomName || '커뮤니티')}</span></div>
    <h2 class="text-2xl font-bold text-gray-900 font-display mb-3 pr-8">${escapeHtml(p.title)}</h2>
    <div class="flex items-center gap-3 text-[13px] text-gray-400 mb-5"><div class="flex items-center gap-1.5"><div class="w-6 h-6 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-white text-[10px] font-bold">${escapeHtml(nick[0])}</div><span class="text-gray-600 font-bold">${escapeHtml(nick)}</span></div><span>${escapeHtml(timeAgo(p.createdAt))}</span></div>
    <p class="text-[15px] text-gray-700 leading-relaxed whitespace-pre-wrap mb-6">${escapeHtml(p.body)}</p>
    <div class="flex items-center gap-3 pb-5 border-b border-gray-100">
      <button data-action="LIKE_POST" data-post-id="${escapeAttr(p.id)}" class="flex items-center gap-1.5 px-4 py-2 rounded-full ${p._liked ? 'bg-red-50 text-red-500 border-red-100' : 'bg-gray-50 text-gray-600 border-gray-200'} border text-[13px] font-bold hover:bg-red-50 hover:text-red-500 transition-all"><i class="ph-fill ph-heart"></i> 공감 ${p.likeCount || 0}</button>
      <span class="flex items-center gap-1.5 text-[13px] text-gray-400 font-bold"><i class="ph-fill ph-chat-circle"></i> 댓글 ${totalComments}</span>
    </div>
    <div class="pt-5 space-y-3">${commentsHtml}</div>
    <div class="mt-5 flex gap-2">
      <input data-input="comment-body" type="text" placeholder="${state.auth?.token ? '따뜻한 댓글을 남겨주세요…' : '로그인 후 댓글을 남길 수 있어요'}" ${state.auth?.token ? '' : 'disabled'} class="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-primary disabled:opacity-60" />
      <button data-action="SUBMIT_COMMENT" data-post-id="${escapeAttr(p.id)}" class="px-4 py-3 bg-primary text-white rounded-xl text-[14px] font-bold whitespace-nowrap">등록</button>
    </div>`;
}

async function likePost(postId) {
  if (!requireAuth('공감은 로그인 후 가능해요.')) return;
  const p = state.posts.find((x) => x.id === postId);
  if (!p) return;
  try {
    const data = await api(`/v1/community/posts/${encodeURIComponent(postId)}/like`, { method: 'POST' });
    p.likeCount = data.likeCount;
    p._liked = data.liked;
    renderPostDetail();
    renderPosts();
  } catch (err) {
    toast(err.message || '공감에 실패했어요.');
  }
}

async function submitComment(postId) {
  if (!requireAuth('댓글은 로그인 후 가능해요.')) return;
  const input = $('[data-input="comment-body"]');
  const body = (input?.value || '').trim();
  if (!body) return;
  try {
    const data = await api(`/v1/community/posts/${encodeURIComponent(postId)}/comments`, { method: 'POST', body: { body, anonymous: true } });
    if (!state.comments[postId]) state.comments[postId] = [];
    state.comments[postId].push(data);
    const p = state.posts.find((x) => x.id === postId);
    if (p) p.commentCount = (p.commentCount || 0) + 1;
    if (input) input.value = '';
    renderPostDetail();
    renderPosts();
  } catch (err) {
    toast(err.message || '댓글 등록에 실패했어요.');
  }
}

// expose a tiny hook for debugging / verification
window.__april = { state, api };

// Boot after all module-level constants are initialized (avoids TDZ on the
// facet constants that boot() reads synchronously via render helpers).
boot();
