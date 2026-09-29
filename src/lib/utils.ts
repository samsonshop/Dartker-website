import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware class name merge. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Turn any string into a URL-safe slug. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    // Drop apostrophes rather than turning them into separators, so
    // "Men's Slim Fit Blazer" becomes "mens-slim-fit-blazer".
    .replace(/['\u2019`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

/** Stable, collision-resistant slug for user-entered product names. */
export function uniqueSlug(value: string): string {
  return `${slugify(value)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * Strips a trailing brand suffix from a meta title held in the database.
 *
 * The root layout's title template already appends " | Dartler", so a stored
 * `meta_title` of "Combs | Dartler" would render as "Combs | Dartler | Dartler".
 * Normalising here means an admin can type the title either way and the rendered
 * result is the same.
 */
export function stripBrandSuffix(title: string): string {
  return title.replace(/\s*[|–—-]\s*Dartler\s*$/i, '').trim() || title.trim();
}

/**
 * Serialises a value for injection into an inline `<script>` tag.
 *
 * `JSON.stringify` does not escape `<`, `>` or `&`, so a value containing
 * `</script>` would close the tag early and everything after it would be parsed
 * as HTML — which turns admin-entered product copy into a script-injection
 * vector on the storefront. Escaping the three characters as `\uXXXX` keeps the
 * JSON byte-for-byte equivalent (JSON.parse yields the same string) while making
 * tag-breakout impossible.
 *
 * U+2028/U+2029 deliberately are not escaped: they only matter when injecting
 * into executable JavaScript, and `application/ld+json` is parsed as data, never
 * run. Escape them here too if this is ever reused for an inline JS payload.
 */
export function jsonLdScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export function formatDate(value: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...opts,
  }).format(date);
}

export function formatDateTime(value: Date | string): string {
  return formatDate(value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

/** Percentage change between two numbers, guarding divide-by-zero. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function range(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

/** Read a possibly-repeated query string value as a single string. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** Read a possibly-repeated query string value as an array. */
export function arrayParam(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((v) => v.split(',')).filter(Boolean);
  return value.split(',').filter(Boolean);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Escape a string for safe inclusion in CSV output. */
export function csvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
