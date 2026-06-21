// Toasts + modal dialog (focus-trapped, ESC/overlay-close) — Re:Connect 룩.
import { h, icon, clear } from "./ui.js";

const stack = () => document.getElementById("toast-stack");

export function toast(message, { type = "info", title = "", timeout = 4200 } = {}) {
  const ico = type === "ok" ? "checkCircle" : type === "bad" ? "alert" : "info";
  const node = h("div", { class: `toast ${type === "info" ? "" : type}`, role: "status" },
    icon(ico, { size: 19, cls: "t-ico" }),
    h("div", { class: "t-body" },
      title && h("div", { class: "t-title" }, title),
      h("div", null, message)),
    h("button", { class: "t-close", "aria-label": "닫기", onclick: () => dismiss() }, "×"));
  function dismiss() {
    node.classList.add("leaving");
    node.addEventListener("animationend", () => node.remove(), { once: true });
  }
  stack().append(node);
  if (timeout) setTimeout(dismiss, timeout);
  return dismiss;
}

let openCount = 0;
export function modal({ title = "", sub = "", body, footer, onClose } = {}) {
  const root = document.getElementById("modal-root");
  const prevFocus = document.activeElement;

  const close = () => {
    overlay.remove();
    openCount = Math.max(0, openCount - 1);
    if (!openCount) document.body.style.overflow = "";
    document.removeEventListener("keydown", onKey);
    onClose?.();
    if (prevFocus && prevFocus.focus) prevFocus.focus();
  };

  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    if (e.key === "Tab") trapTab(e, dialog);
  };

  const dialog = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": title, tabindex: "-1" },
    h("div", { class: "modal-head" },
      h("div", null,
        h("h3", null, title),
        sub && h("div", { class: "sub mono" }, sub)),
      h("button", { class: "modal-close", "aria-label": "닫기", onclick: close }, "×")),
    h("div", { class: "modal-body" }, body),
    footer && h("div", { class: "modal-foot" }, footer));

  const overlay = h("div", { class: "modal-overlay",
    onclick: (e) => { if (e.target === overlay) close(); } }, dialog);

  clear(root).append(overlay);
  openCount++;
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", onKey);
  const first = dialog.querySelector("input, select, textarea, button:not(.modal-close)");
  (first || dialog).focus?.();

  return { close, dialog };
}

function trapTab(e, container) {
  const focusables = container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
  if (!focusables.length) return;
  const first = focusables[0], last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
