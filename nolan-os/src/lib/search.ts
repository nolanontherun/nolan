import { all } from "./db";
import { agencyRows, bestValue, companyRows, contactRows, loadDeals } from "./queries";
import { daysFromToday, money } from "./format";

export type Hit = { kind: string; id: string; title: string; sub: string; href: string };
export type SearchResult = { interpreted: string[]; groups: { kind: string; hits: Hit[] }[]; total: number };

const STOP = new Set(["deals", "deal", "brands", "brand", "companies", "company", "contacts", "contact", "all", "show", "me", "everyone", "i've", "ive", "i", "worked", "with", "at", "from", "in", "over", "the", "of", "and", "who", "have", "haven't", "havent", "spoken", "to", "more", "than", "once", "any", "list", "find", "people", "that", "are", "my", "invoices", "invoice", "above", "under", "below", "months", "month", "ago", "offered", "me", "a", "an"]);
const TAG_WORDS: Record<string, string> = { camera: "Camera", cameras: "Camera", travel: "Travel", outdoor: "Outdoor", outdoors: "Outdoor", automotive: "Automotive", auto: "Automotive", fashion: "Fashion", tech: "Tech", tourism: "Tourism", hotel: "Hotel", hotels: "Hotel", food: "Food", adventure: "Adventure", software: "Software", gear: "Gear", clothing: "Clothing", music: "Music", apps: "Software" };

export function search(raw: string, limit = 8): SearchResult {
  const q = raw.trim();
  const interpreted: string[] = [];
  if (!q) return { interpreted, groups: [], total: 0 };
  let s = q.toLowerCase();
  const f: { min?: number; max?: number; unpaid?: boolean; year?: string; tag?: string; agencies?: boolean; paidUsage?: boolean; repeat?: boolean; staleMonths?: number } = {};
  let m = s.match(/(?:over|above|more than|greater than|>)\s*\$?(\d[\d,.]*)\s*(k)?/);
  if (m) { f.min = Math.round(parseFloat(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1) * 100); s = s.replace(m[0], " "); interpreted.push(`amount over ${money(f.min)}`); }
  m = s.match(/(?:under|below|less than|<)\s*\$?(\d[\d,.]*)\s*(k)?/);
  if (m) { f.max = Math.round(parseFloat(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1) * 100); s = s.replace(m[0], " "); interpreted.push(`amount under ${money(f.max)}`); }
  if (/\b(unpaid|outstanding|overdue)\b/.test(s)) { f.unpaid = true; s = s.replace(/\b(unpaid|outstanding|overdue)\b/g, " "); interpreted.push("unpaid"); }
  m = s.match(/\b(20\d{2})\b/);
  if (m) { f.year = m[1]; s = s.replace(m[0], " "); interpreted.push(`year ${f.year}`); }
  if (/\bpaid usage\b|\bwith usage\b|\busage rights\b/.test(s)) { f.paidUsage = true; s = s.replace(/paid usage|with usage|usage rights/g, " "); interpreted.push("has paid usage"); }
  if (/\bagenc(y|ies)\b/.test(s)) { f.agencies = true; s = s.replace(/\bagenc(y|ies)\b/g, " "); interpreted.push("agencies"); }
  if (/more than once|repeat|multiple times|worked with more than once/.test(s)) { f.repeat = true; s = s.replace(/more than once|repeat|multiple times/g, " "); interpreted.push("more than one deal"); }
  m = s.match(/(\d+)\s*months?/);
  if (m && /(spoken|talk|contact|haven)/.test(s)) { f.staleMonths = +m[1]; interpreted.push(`no contact in ${m[1]}+ months`); }
  const words = s.split(/[^a-z0-9&.@+'-]+/).filter(Boolean);
  const terms: string[] = [];
  for (const w of words) {
    if (TAG_WORDS[w]) { f.tag = TAG_WORDS[w]; interpreted.push(`tag: ${f.tag}`); continue; }
    if (!STOP.has(w)) terms.push(w);
  }
  if (terms.length) interpreted.push(`matching “${terms.join(" ")}”`);
  const hit = (...fields: (string | null | undefined)[]) => terms.every((t) => fields.some((x) => (x ?? "").toLowerCase().includes(t)));
  const deals = loadDeals();
  const groups: { kind: string; hits: Hit[] }[] = [];
  const cap = <T,>(x: T[]) => x.slice(0, limit);

  const dealHits = deals.filter((d) => {
    if (!hit(d.name, d.company_name, d.agency_name, d.contact_name, d.category, d.source_notes, d.deal_type, d.tags.join(" "))) return false;
    if (f.tag && !(d.tags.includes(f.tag) || (f.tag === "Camera" && d.category === "Tech & Cameras"))) return false;
    if (f.year && d.year !== f.year) return false;
    if (f.unpaid && !d.fin.outstanding) return false;
    const v = d.fin.gross ?? bestValue(d);
    if (f.min !== undefined && !(v !== null && v >= f.min)) return false;
    if (f.max !== undefined && !(v !== null && v <= f.max)) return false;
    return true;
  });
  let paidUsageIds: Set<string> | null = null;
  if (f.paidUsage) paidUsageIds = new Set(all<{ deal_id: string }>("SELECT deal_id FROM usage_rights WHERE kind IN ('Paid usage','Advertising','Creator whitelisting','Dark posting') UNION SELECT id FROM deals WHERE usage_fee > 0").map((x) => x.deal_id));
  const dh = paidUsageIds ? dealHits.filter((d) => paidUsageIds!.has(d.id)) : dealHits;
  groups.push({ kind: "Deals", hits: dh.slice(0, limit * 4).map((d) => ({ kind: "Deal", id: d.id, title: d.name, sub: `${d.stage} · ${money(d.fin.gross ?? bestValue(d), d.currency)}${d.fin.outstanding ? " · unpaid" : ""} · ${d.year}`, href: `/deals/${d.id}` })) });

  if (!f.min && !f.max && !f.unpaid && !f.paidUsage) {
    const cos = companyRows().filter((c) => hit(c.name, c.category, c.company_type, c.notes, c.tags.join(" ")) && (!f.tag || c.tags.includes(f.tag)) && (!f.year || c.deals.some((d: any) => d.year === f.year)) && (!f.repeat || c.dealCount > 1));
    groups.push({ kind: "Companies", hits: cap(cos).map((c) => ({ kind: "Company", id: c.id, title: c.name, sub: `${c.dealCount} deal${c.dealCount === 1 ? "" : "s"}${c.category ? " · " + c.category : ""}`, href: `/companies/${c.id}` })) });
    const ags = f.tag || f.year ? [] : agencyRows().filter((a) => hit(a.name, a.specialty, a.notes));
    groups.push({ kind: "Agencies", hits: cap(ags).map((a) => ({ kind: "Agency", id: a.id, title: a.name, sub: `${a.dealCount} deal${a.dealCount === 1 ? "" : "s"} · ${a.contact_count} contact${a.contact_count === 1 ? "" : "s"}`, href: `/agencies/${a.id}` })) });
    const cts = contactRows().filter((c) => {
      if (!hit(c.full_name, c.email, c.job_title, c.company_name, c.agency_name, c.notes, c.tags.join(" "))) return false;
      if (f.agencies && !c.agency_id) return false;
      if (f.staleMonths) { const last = c.last_contact_effective; if (last && daysFromToday(last)! > -f.staleMonths * 30) return false; }
      return true;
    });
    groups.push({ kind: "People", hits: cap(cts).map((c) => ({ kind: "Contact", id: c.id, title: c.full_name, sub: [c.job_title, c.company_name ?? c.agency_name].filter(Boolean).join(" · ") || "Company not recorded", href: `/contacts/${c.id}` })) });
    if (terms.length) {
      const like = (cols: string[]) => cols.map((c) => `LOWER(COALESCE(${c},'')) LIKE ?`).join(" OR ");
      const ps = (cols: string[]) => terms.map(() => `(${like(cols)})`).join(" AND ");
      const args = (n: number) => terms.flatMap((t) => Array(n).fill(`%${t}%`));
      groups.push({ kind: "Campaigns", hits: cap(all<any>(`SELECT c.id, c.name, co.name cn FROM campaigns c LEFT JOIN companies co ON co.id=c.company_id WHERE ${ps(["c.name", "co.name"])}`, ...args(2))).map((c) => ({ kind: "Campaign", id: c.id, title: c.name, sub: c.cn ?? "", href: "/campaigns" })) });
      groups.push({ kind: "Invoices", hits: cap(all<any>(`SELECT i.id, i.number, i.status, i.amount, i.currency, i.description FROM invoices i WHERE ${ps(["i.number", "i.description", "i.status", "i.bill_to_name"])}`, ...args(4))).map((i) => ({ kind: "Invoice", id: i.id, title: i.number ?? "Invoice (number not recorded)", sub: `${i.status} · ${money(i.amount, i.currency)}`, href: `/invoices/${i.id}` })) });
      groups.push({ kind: "Emails", hits: cap(all<any>(`SELECT id, subject, sender, date, snippet FROM communications WHERE ${ps(["subject", "snippet", "sender", "company_name", "body"])} ORDER BY date DESC`, ...args(5))).map((c) => ({ kind: "Email", id: c.id, title: c.subject ?? "(no subject)", sub: `${c.sender ?? ""} · ${c.date ?? "undated"}`, href: `/inbox?q=${encodeURIComponent(terms.join(" "))}` })) });
      groups.push({ kind: "Notes and deliverables", hits: cap([
        ...all<any>(`SELECT n.id, n.body, n.entity, n.entity_id FROM notes n WHERE ${ps(["n.body"])}`, ...args(1)).map((n) => ({ kind: "Note", id: n.id, title: n.body.slice(0, 80), sub: `Note on ${n.entity}`, href: n.entity === "deal" ? `/deals/${n.entity_id}` : "/" })),
        ...all<any>(`SELECT v.id, v.deal_id, v.platform, v.content_type, v.notes, d.name dn FROM deliverables v JOIN deals d ON d.id=v.deal_id WHERE ${ps(["v.notes", "v.platform", "v.content_type", "v.url"])}`, ...args(4)).map((v) => ({ kind: "Deliverable", id: v.id, title: [v.platform, v.content_type].filter(Boolean).join(" ") || "Deliverable", sub: v.dn, href: `/deals/${v.deal_id}` })),
      ]) });
    }
  } else if (f.unpaid) {
    groups.push({ kind: "Invoices", hits: cap(all<any>("SELECT id, number, status, amount, currency FROM invoices WHERE status IN ('Sent','Viewed','Partially paid','Overdue','Draft')")).map((i) => ({ kind: "Invoice", id: i.id, title: i.number ?? "Invoice (number not recorded)", sub: `${i.status} · ${money(i.amount, i.currency)}`, href: `/invoices/${i.id}` })) });
  }
  if (f.min !== undefined && !f.unpaid) {
    const cts = contactRows().filter((c) => c.maxOffer >= f.min!);
    groups.push({ kind: "People who offered or agreed more", hits: cap(cts).map((c) => ({ kind: "Contact", id: c.id, title: c.full_name, sub: `${c.company_name ?? c.agency_name ?? ""} · top ${money(c.maxOffer)}`, href: `/contacts/${c.id}` })) });
  }
  const g = groups.filter((x) => x.hits.length);
  return { interpreted, groups: g, total: g.reduce((s, x) => s + x.hits.length, 0) };
}
