import { isSafeHref, isSafeImageSrc, isValidEmail } from "../lib/safeUrl";

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;

type ListRules = { min?: number; max?: number; itemMax?: number; allowEmpty?: boolean };

/**
 * Tiny validation helper. Collects human-friendly issues instead of throwing,
 * so the admin sees every problem at once before committing.
 */
export function createChecker() {
  const issues: string[] = [];

  return {
    issues,
    check(condition: boolean, message: string) {
      if (!condition) issues.push(message);
    },
    required(label: string, value: string, max = 160) {
      const v = (value ?? "").trim();
      if (!v) issues.push(`${label} is required.`);
      else if (v.length > max) issues.push(`${label} must be ${max} characters or fewer.`);
    },
    optional(label: string, value: string | undefined, max = 160) {
      if (value && value.trim().length > max) issues.push(`${label} must be ${max} characters or fewer.`);
    },
    email(label: string, value: string) {
      if (!isValidEmail(value)) issues.push(`${label} must be a valid email address.`);
    },
    href(label: string, value: string, required = true) {
      const v = (value ?? "").trim();
      if (!v) {
        if (required) issues.push(`${label} is required.`);
        return;
      }
      if (!isSafeHref(v)) {
        issues.push(`${label} must start with https://, mailto:, # or / (no spaces or scripts).`);
      }
    },
    image(label: string, value: string) {
      if (!isSafeImageSrc(value ?? "")) {
        issues.push(`${label} must be an https:// image URL or a /path inside the public folder.`);
      }
    },
    slug(label: string, value: string) {
      if (!SLUG_RE.test(value)) {
        issues.push(`${label} must use lowercase letters, numbers and dashes only (max 60).`);
      }
    },
    list(label: string, items: string[], rules: ListRules = {}) {
      const { min = 0, max = 50, itemMax = 200, allowEmpty = false } = rules;
      if (items.length < min) issues.push(`${label} needs at least ${min} item${min === 1 ? "" : "s"}.`);
      if (items.length > max) issues.push(`${label} can have at most ${max} items.`);
      items.forEach((item, idx) => {
        const v = (item ?? "").trim();
        if (!v && !allowEmpty) issues.push(`${label} #${idx + 1} is empty.`);
        if ((item ?? "").length > itemMax) issues.push(`${label} #${idx + 1} must be ${itemMax} characters or fewer.`);
      });
    },
  };
}

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "item";
}

export function sanitizeSlugInput(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, 60);
}

export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const root = slugify(base);
  if (!used.has(root)) return root;
  for (let n = 2; n < 1000; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${root.slice(0, 60 - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${root.slice(0, 50)}-${Date.now().toString(36).slice(-6)}`;
}
