import { SYMBOL } from "./constants";

export const NR = "Not recorded";

/** minor units -> display. null stays "Not recorded"; never converts currencies. */
export function money(minor: number | null | undefined, currency = "USD", opts: { compact?: boolean; cents?: boolean } = {}) {
  if (minor === null || minor === undefined) return NR;
  const v = minor / 100;
  const sym = SYMBOL[currency] ?? `${currency} `;
  const neg = v < 0 ? "−" : "";
  const abs = Math.abs(v);
  if (opts.compact && abs >= 10000) return `${neg}${sym}${(abs / 1000).toFixed(abs >= 100000 ? 0 : 1).replace(/\.0$/, "")}k`;
  const frac = opts.cents || Math.round(abs) !== abs ? 2 : 0;
  return `${neg}${sym}${abs.toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: frac })}`;
}

export function moneyMap(m: Record<string, number>, opts: { compact?: boolean } = {}) {
  const entries = Object.entries(m).filter(([, v]) => v !== 0);
  if (!entries.length) return money(0, "USD");
  entries.sort((a, b) => (a[0] === "USD" ? -1 : b[0] === "USD" ? 1 : a[0].localeCompare(b[0])));
  return entries.map(([c, v]) => money(v, c, opts)).join(" + ");
}

export function parseMoney(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim().toLowerCase().replace(/[,\s$€£¥]/g, "");
  if (!s) return null;
  const m = s.match(/^(-?\d+(?:\.\d+)?)(k)?$/);
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * (m[2] ? 1000 : 1) * 100);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function parseISO(d: string | null | undefined): Date | null {
  if (!d) return null;
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
export function dateLabel(d: string | null | undefined, opts: { year?: boolean } = {}) {
  const x = parseISO(d);
  if (!x) return "—";
  const y = x.getUTCFullYear();
  const showYear = opts.year ?? y !== new Date().getUTCFullYear();
  return `${MONTHS[x.getUTCMonth()]} ${x.getUTCDate()}${showYear ? `, ${y}` : ""}`;
}
export function daysBetween(a: string, b: string) {
  return Math.round((parseISO(b)!.getTime() - parseISO(a)!.getTime()) / 86400000);
}
export function daysFromToday(d: string | null | undefined): number | null {
  if (!d) return null;
  return daysBetween(today(), d);
}
export function relDays(n: number | null) {
  if (n === null) return "";
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
export function addDays(d: string, n: number) {
  const x = parseISO(d)!;
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
export function monthKey(d: string) {
  return d.slice(0, 7);
}
export function monthLabel(k: string) {
  const [y, m] = k.split("-");
  return `${MONTHS[+m - 1]} ${y}`;
}
export function quarterOf(d: string) {
  const [y, m] = d.split("-").map(Number);
  return `${y}-Q${Math.ceil(m / 3)}`;
}
export function pct(n: number, d: number) {
  return d ? `${Math.round((n / d) * 100)}%` : "—";
}
export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
export function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
