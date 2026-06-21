// Minimal observable store: just the active role (drives X-Role on every call).
import { DEFAULT_ROLE, ROLES } from "./config.js";

const KEY = "styleon.role";
const valid = new Set(ROLES.map(r => r.id));

let role = (() => {
  try {
    const saved = localStorage.getItem(KEY);
    return valid.has(saved) ? saved : DEFAULT_ROLE;
  } catch { return DEFAULT_ROLE; }
})();

const subs = new Set();

export function getRole() { return role; }

export function setRole(next) {
  if (!valid.has(next) || next === role) return;
  role = next;
  try { localStorage.setItem(KEY, role); } catch { /* ignore */ }
  for (const fn of subs) fn(role);
}

export function onRole(fn) { subs.add(fn); return () => subs.delete(fn); }

export function roleMeta(id = role) { return ROLES.find(r => r.id === id); }
