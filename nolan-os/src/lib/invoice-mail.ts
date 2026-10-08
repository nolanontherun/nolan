import { addDays, parseISO } from "./format";

/** Pure helpers shared by the invoice form, the PDF and the email writer. No database access, so they are unit tested. */

export type DueMode = "receipt" | "date" | "net";
export const DUE_RECEIPT = "Due on receipt";

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function longDate(d: string | null | undefined): string {
  const x = parseISO(d);
  return x ? `${MONTHS_LONG[x.getUTCMonth()]} ${x.getUTCDate()}, ${x.getUTCFullYear()}` : "";
}

/** Turns the "when is it due" choice into the stored due date and terms. */
export function resolveDue(mode: DueMode, issue: string, opts: { date?: string | null; days?: number | null } = {}): { due: string; terms: string } {
  if (mode === "date" && opts.date) return { due: opts.date, terms: `Due ${longDate(opts.date)}` };
  if (mode === "net") { const n = opts.days && opts.days > 0 ? Math.round(opts.days) : 30; return { due: addDays(issue, n), terms: `Net ${n}` }; }
  return { due: issue, terms: DUE_RECEIPT };
}

export const isReceipt = (terms: string | null | undefined) => (terms ?? "").toLowerCase().startsWith("due on receipt");

/** "On receipt" or "October 31, 2026" for the invoice and the email. */
export function dueDisplay(terms: string | null | undefined, due: string | null | undefined): string {
  if (isReceipt(terms)) return "On receipt";
  return longDate(due) || "On receipt";
}

const CURRENCY_NAME: Record<string, string> = { USD: "US dollars", EUR: "euros", GBP: "pounds sterling", CAD: "Canadian dollars", AUD: "Australian dollars", JPY: "yen", CHF: "Swiss francs" };
export const currencyName = (c: string) => CURRENCY_NAME[c] ?? c;

/** An invoice line is stored as one string: first line is the service, the rest is the detail. */
export function splitItem(description: string): { title: string; detail: string } {
  const [title, ...rest] = String(description ?? "").split("\n");
  return { title: title.trim(), detail: rest.join(" ").trim() };
}
export const joinItem = (title: string, detail: string) => [title.trim(), detail.trim()].filter(Boolean).join("\n");

export type Brand = { legal: string; production: string; address: string; email: string; owner: string };
/** Brand details come from Settings. The fallbacks are only used until you fill Settings in. */
export function brandFrom(profile: Record<string, string | undefined>): Brand {
  // Nothing about your business is hard-coded: it all comes from Settings (this repository is public).
  return {
    legal: profile.legalName || profile.business || "Your business name",
    production: profile.production ?? "",
    address: profile.address ?? "",
    email: profile.email ?? "",
    owner: (profile.name || "Me").split(" ")[0],
  };
}

/** "12 Main Street, Springfield, Ohio, USA" -> two short lines for the invoice. */
export function addressLines(address: string): string[] {
  const parts = (address ?? "").split(/,\s*/).filter(Boolean);
  const out: string[] = [];
  parts.forEach((p, n) => { if (n % 2 === 0) out.push(p); else out[out.length - 1] += `, ${p}`; });
  return out;
}

export type MailKind = "booking" | "invoice" | "reminder" | "thanks";
export const MAIL_KINDS: { kind: MailKind; label: string }[] = [
  { kind: "booking", label: "Reply + invoice" },
  { kind: "invoice", label: "Invoice only" },
  { kind: "reminder", label: "Payment reminder" },
  { kind: "thanks", label: "Thank you" },
];

export type MailInput = { kind: MailKind; clientName: string | null; service: string; number: string; amount: string; dueText: string; brand: Brand };
const firstName = (n: string | null) => (n ?? "").trim().split(/\s+/)[0] || "there";
/** Lowercases a service name used mid-sentence, unless it carries its own capitals ("Instagram Reel", "YouTube integration"). */
export const midSentence = (s: string) => (/[A-Z]/.test(s.slice(1)) ? s : s.charAt(0).toLowerCase() + s.slice(1));
const dueSentence = (dueText: string) => (dueText.toLowerCase() === "on receipt" ? "due on receipt" : `due on ${dueText}`);

/** Writes a warm, plain email for the invoice. Everything stays editable in the app before sending. */
export function buildInvoiceEmail(i: MailInput): { subject: string; body: string } {
  const hi = `Hi ${firstName(i.clientName)},`;
  const sign = `${i.brand.owner}\n${[i.brand.production, i.brand.legal].filter(Boolean).join(" · ")}\n${i.brand.email}`;
  const svc = i.service ? midSentence(i.service) : "your project";
  switch (i.kind) {
    case "booking":
      return {
        subject: `${i.service || "Your project"}: invoice ${i.number}`,
        body: `${hi}\n\nThank you so much for reaching out. I'd love to work with you on ${svc}.\n\nI've attached the invoice for ${i.amount}, ${dueSentence(i.dueText)}. If you'd like to pay another way or earlier, just reply and I'll send the payment options.\n\nI'm really looking forward to it. If you have any questions in the meantime, reply here anytime.\n\nWarmly,\n${sign}`,
      };
    case "invoice":
      return { subject: `Invoice ${i.number}: ${svc}`, body: `${hi}\n\nPlease find attached invoice ${i.number} for ${svc}: ${i.amount}, ${dueSentence(i.dueText)}.\n\nIf anything is missing or you'd like to pay another way, just reply to this email.\n\nThank you,\n${sign}` };
    case "reminder":
      return { subject: `Payment reminder: invoice ${i.number}`, body: `${hi}\n\nA friendly reminder that invoice ${i.number} for ${svc} (${i.amount}) is ${dueSentence(i.dueText)}. I've attached it again for convenience.\n\nIf it has already been taken care of, thank you, and please ignore this note.\n\nThank you,\n${sign}` };
    case "thanks":
      return { subject: `Thank you: ${svc}`, body: `${hi}\n\nThank you for trusting me with ${svc}. It meant a lot, and I'm grateful to have been part of it.\n\nIf there is anything else I can do, just reply to this email.\n\nWarmly,\n${sign}` };
  }
}

export const isEmail = (s: string) => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(s.trim());
/** Splits "a@x.com, b@y.com" and drops anything that is not an address. */
export function parseRecipients(raw: string): { valid: string[]; invalid: string[] } {
  const parts = raw.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
  return { valid: parts.filter(isEmail), invalid: parts.filter((x) => !isEmail(x)) };
}
