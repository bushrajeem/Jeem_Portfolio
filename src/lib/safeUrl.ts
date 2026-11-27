/**
 * URL & email sanitizers (defense in depth).
 * Even if someone managed to write a malicious value like `javascript:alert(1)`
 * into Firestore, the public site and admin panel refuse to render it.
 */

const CONTROL_OR_SPACE = /[\s\u0000-\u001F\u007F]/;
const STRICT_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  return v.length > 0 && v.length <= 254 && STRICT_EMAIL.test(v);
}

/** Allows https/http links, mailto:, in-page #anchors and same-site /paths only. */
export function isSafeHref(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 2048 || CONTROL_OR_SPACE.test(v)) return false;
  if (/^https?:\/\/[^/\\]/i.test(v)) return true;
  if (/^mailto:/i.test(v)) return isValidEmail(v.slice(7).split("?")[0] ?? "");
  if (/^#[A-Za-z0-9_-]*$/.test(v)) return true;
  return /^\/(?![/\\])/.test(v);
}

/** Images may only come from https URLs or same-site /paths. */
export function isSafeImageSrc(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 2048 || CONTROL_OR_SPACE.test(v)) return false;
  return /^https:\/\/[^/\\]/i.test(v) || /^\/(?![/\\])/.test(v);
}

export function safeHref(value: unknown, fallback: string): string {
  return typeof value === "string" && isSafeHref(value) ? value.trim() : fallback;
}

export function safeImageSrc(value: unknown, fallback: string): string {
  return typeof value === "string" && isSafeImageSrc(value) ? value.trim() : fallback;
}
