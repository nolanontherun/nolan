import { cache } from "react";
import { all, get, getSetting } from "./db";
import { addMoney, dealFinance, DealFinance, termsDays } from "./calc";
import { BOOKED_STAGES, NEGOTIATING_STAGES, OPEN_STAGES, STAGES } from "./constants";
import { addDays, daysBetween, monthKey, today } from "./format";

export type Deal = {
  id: string; name: string; company_id: string | null; agency_id: string | null; contact_id: string | null; campaign_id: string | null; stage: string; status: string;
  deal_source: string | null; deal_type: string | null; client_type: string | null; category: string | null; date_received: string | null; date_contacted: string | null;
  date_negotiated: string | null; date_agreed: string | null; contract_date: string | null; campaign_date: string | null; posting_date: string | null; completion_date: string | null;
  invoice_date: string | null; currency: string; initial_offer: number | null; counter_offer: number | null; final_amount: number | null; product_value: number | null;
  production_budget: number | null; travel_budget: number | null; crew_budget: number | null; talent_budget: number | null; usage_fee: number | null; exclusivity_fee: number | null;
  whitelisting_fee: number | null; licensing_fee: number | null; affiliate_commission: number | null; payment_terms: string | null; payment_state: string; payment_verification: string | null;
  manual_outstanding: number | null; manual_outstanding_currency: string | null; manual_outstanding_note: string | null; next_action: string | null; next_followup: string | null; reminder: string | null;
  source: string | null; source_notes: string | null; original_source: string | null; field_status: string | null; archived: number; updated_at: string | null; created_at: string | null;
};
export type DealX = Deal & {
  company_name: string | null; agency_name: string | null; contact_name: string | null; tags: string[]; fin: DealFinance; paid_date: string | null; deal_date: string | null; year: string;
  platforms: string[]; invoice_due: string | null; days_outstanding: number | null;
};

export function allTags(table: "deal_tags" | "company_tags" | "contact_tags", key: string) {
  const rows = all<{ k: string; name: string }>(`SELECT t.${key} k, g.name FROM ${table} t JOIN tags g ON g.id = t.tag_id`);
  const m = new Map<string, string[]>();
  for (const r of rows) (m.get(r.k) ?? m.set(r.k, []).get(r.k)!).push(r.name);
  return m;
}

export const loadDeals = cache(loadDealsUncached);
function loadDealsUncached(): DealX[] {
  const rows = all<Deal & { company_name: string | null; agency_name: string | null; contact_name: string | null }>(`
    SELECT d.*, c.name company_name, a.name agency_name, ct.full_name contact_name FROM deals d
    LEFT JOIN companies c ON c.id = d.company_id LEFT JOIN agencies a ON a.id = d.agency_id LEFT JOIN contacts ct ON ct.id = d.contact_id
    WHERE d.archived = 0 ORDER BY COALESCE((SELECT MAX(date) FROM payments p WHERE p.deal_id = d.id), d.posting_date, d.date_agreed, '0000') DESC, d.name`);
  const pays = all<any>("SELECT deal_id, amount, currency, date FROM payments");
  const exps = all<any>("SELECT deal_id, amount, currency FROM expenses");
  const dtags = allTags("deal_tags", "deal_id");
  const plats = all<{ deal_id: string; platform: string | null }>("SELECT deal_id, platform FROM deliverables");
  const invs = all<any>("SELECT deal_id, due_date FROM invoices WHERE due_date IS NOT NULL AND status NOT IN ('Void','Paid')");
  const t = today();
  const by = <T extends { deal_id: string | null }>(xs: T[]) => { const m = new Map<string, T[]>(); for (const x of xs) if (x.deal_id) (m.get(x.deal_id) ?? m.set(x.deal_id, []).get(x.deal_id)!).push(x); return m; };
  const pm = by(pays), em = by(exps), plm = by(plats), im = by(invs);
  return rows.map((d) => {
    const dp = pm.get(d.id) ?? [];
    const fin = dealFinance(d, dp, em.get(d.id) ?? []);
    const paid_date = dp.map((p: any) => p.date).filter(Boolean).sort().pop() ?? null;
    const deal_date = paid_date ?? d.posting_date ?? d.date_agreed ?? d.invoice_date ?? null;
    const invoice_due = (im.get(d.id) ?? []).map((i: any) => i.due_date).sort()[0] ?? (d.invoice_date ? addDays(d.invoice_date, termsDays(d.payment_terms)) : null);
    let days_outstanding: number | null = null;
    if (fin.outstanding) {
      const from = d.invoice_date ?? d.posting_date;
      days_outstanding = from ? Math.max(0, daysBetween(from, t)) : null;
    }
    return { ...d, tags: dtags.get(d.id) ?? [], fin, paid_date, deal_date, year: deal_date ? deal_date.slice(0, 4) : "Undated", platforms: [...new Set((plm.get(d.id) ?? []).map((p) => p.platform).filter(Boolean) as string[])], invoice_due, days_outstanding };
  });
}

export function bestValue(d: Deal): number | null {
  return d.final_amount ?? d.initial_offer ?? d.counter_offer ?? null;
}

// ---------------------------------------------------------------- dashboard
export const dashboard = cache(dashboardUncached);
function dashboardUncached() {
  const t = today();
  const deals = loadDeals();
  const pays = all<{ amount: number | null; currency: string; date: string | null; deal_id: string | null }>("SELECT amount, currency, date, deal_id FROM payments");
  const year = t.slice(0, 4), month = t.slice(0, 7);
  const q = `${year}-Q${Math.ceil(+t.slice(5, 7) / 3)}`;
  const quarterOf = (d: string) => `${d.slice(0, 4)}-Q${Math.ceil(+d.slice(5, 7) / 3)}`;
  const rev = { month: {} as Record<string, number>, quarter: {} as Record<string, number>, year: {} as Record<string, number>, lifetime: {} as Record<string, number>, unverified: {} as Record<string, number>, undated: {} as Record<string, number> };
  for (const p of pays) {
    if (p.amount === null) continue;
    addMoney(rev.lifetime, p.currency, p.amount);
    if (!p.date) { addMoney(rev.undated, p.currency, p.amount); continue; }
    if (p.date.startsWith(month)) addMoney(rev.month, p.currency, p.amount);
    if (quarterOf(p.date) === q) addMoney(rev.quarter, p.currency, p.amount);
    if (p.date.startsWith(year)) addMoney(rev.year, p.currency, p.amount);
  }
  for (const d of deals) {
    if (d.payment_state === "presumed_paid") for (const [c, v] of Object.entries(d.fin.recognized)) { addMoney(rev.lifetime, c, v); addMoney(rev.unverified, c, v); }
  }
  const outstanding: Record<string, number> = {}; const overdue: Record<string, number> = {}; let unknownOutstanding = 0; let overdueCount = 0; let outstandingCount = 0;
  for (const d of deals) {
    const o = d.fin.outstanding;
    if (!o) continue;
    outstandingCount++;
    if (o.amount === null) { unknownOutstanding++; continue; }
    addMoney(outstanding, o.currency, o.amount);
    if (d.invoice_due && d.invoice_due < t) { addMoney(overdue, o.currency, o.amount); overdueCount++; }
  }
  const pending: Record<string, number> = {};
  for (const d of deals) if (BOOKED_STAGES.includes(d.stage as any) && d.stage !== "Paid" && d.fin.gross !== null && !d.fin.outstanding) addMoney(pending, d.currency, d.fin.gross);
  const negotiating: Record<string, number> = {}; let negotiatingCount = 0;
  for (const d of deals) if (NEGOTIATING_STAGES.includes(d.stage as any)) { negotiatingCount++; const v = bestValue(d); if (v !== null) addMoney(negotiating, d.currency, v); }
  const booked = deals.filter((d) => BOOKED_STAGES.includes(d.stage as any) && d.fin.gross !== null);
  const avg: Record<string, { sum: number; n: number }> = {};
  for (const d of booked) { (avg[d.currency] ??= { sum: 0, n: 0 }); avg[d.currency].sum += d.fin.gross!; avg[d.currency].n++; }
  const avgDeal = Object.fromEntries(Object.entries(avg).map(([c, v]) => [c, Math.round(v.sum / v.n)]));
  const pipeline = STAGES.map((s) => {
    const ds = deals.filter((d) => d.stage === s);
    const val: Record<string, number> = {};
    for (const d of ds) { const v = s === "Paid" ? d.fin.gross : bestValue(d); if (v !== null && v !== undefined) addMoney(val, d.currency, v); }
    return { stage: s, count: ds.length, value: val, unknown: ds.filter((d) => bestValue(d) === null).length };
  });
  // 12-month sparkline of payments in USD (EUR reported separately)
  const months: string[] = [];
  const cur = new Date(t + "T00:00:00Z");
  for (let i = 11; i >= 0; i--) { const x = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() - i, 1)); months.push(x.toISOString().slice(0, 7)); }
  const series = months.map((m) => ({ key: m, value: pays.filter((p) => p.date?.startsWith(m) && p.currency === "USD").reduce((s, p) => s + (p.amount ?? 0), 0) }));
  return { rev, outstanding, overdue, overdueCount, outstandingCount, unknownOutstanding, pending, negotiating, negotiatingCount, avgDeal, pipeline, series, totalDeals: deals.length, deals };
}

// ---------------------------------------------------------------- analytics
export type AnalyticsFilter = { year?: string; company?: string; category?: string; platform?: string; stage?: string; currency?: string; dealType?: string };
export function analytics(f: AnalyticsFilter) {
  const fx = getSetting<Record<string, number>>("fx", {});
  let deals = loadDeals();
  if (f.year) deals = deals.filter((d) => d.year === f.year);
  if (f.company) deals = deals.filter((d) => d.company_id === f.company);
  if (f.category) deals = deals.filter((d) => d.category === f.category);
  if (f.platform) deals = deals.filter((d) => d.platforms.some((p) => p === f.platform));
  if (f.stage) deals = deals.filter((d) => d.stage === f.stage);
  if (f.dealType) deals = deals.filter((d) => d.deal_type === f.dealType);
  if (f.currency) deals = deals.filter((d) => d.currency === f.currency);
  const delivs = all<{ deal_id: string; platform: string | null; content_type: string | null; quantity: number | null }>("SELECT deal_id, platform, content_type, quantity FROM deliverables");
  const dm = new Map<string, typeof delivs>();
  for (const x of delivs) (dm.get(x.deal_id) ?? dm.set(x.deal_id, []).get(x.deal_id)!).push(x);
  const rec = deals.filter((d) => Object.keys(d.fin.recognized).length);
  const toReport = (c: string, v: number) => (c === "USD" ? v : fx[c] ? Math.round(v * fx[c]) : null);
  const reportable = (d: DealX) => Object.entries(d.fin.recognized).reduce((s, [c, v]) => s + (toReport(c, v) ?? 0), 0);
  const excluded: Record<string, number> = {};
  for (const d of rec) for (const [c, v] of Object.entries(d.fin.recognized)) if (toReport(c, v) === null) addMoney(excluded, c, v);
  const bucket = (keyFn: (d: DealX) => string | string[], valFn: (d: DealX) => number = reportable) => {
    const m = new Map<string, { value: number; deals: number }>();
    for (const d of rec) {
      const ks = keyFn(d); const arr = Array.isArray(ks) ? ks : [ks];
      const v = valFn(d);
      for (const k of arr) { const e = m.get(k) ?? { value: 0, deals: 0 }; e.value += v / arr.length; e.deals += 1 / arr.length; m.set(k, e); }
    }
    return [...m.entries()].map(([key, v]) => ({ key, value: Math.round(v.value), deals: Math.round(v.deals * 100) / 100 })).sort((a, b) => b.value - a.value);
  };
  const byYear = bucket((d) => d.year).sort((a, b) => a.key.localeCompare(b.key));
  const monthsMap = new Map<string, number>();
  const pays = all<any>("SELECT deal_id, amount, currency, date FROM payments WHERE amount IS NOT NULL AND date IS NOT NULL");
  const ids = new Set(deals.map((d) => d.id));
  for (const p of pays) if (ids.has(p.deal_id)) { const v = toReport(p.currency, p.amount); if (v !== null) monthsMap.set(monthKey(p.date), (monthsMap.get(monthKey(p.date)) ?? 0) + v); }
  const byMonth = [...monthsMap.entries()].sort().map(([key, value]) => ({ key, value }));
  const platformOf = (d: DealX) => { const l = dm.get(d.id) ?? []; const ps = l.map((x) => x.platform ?? "Platform not recorded"); return ps.length ? [...new Set(ps)] : ["Platform not recorded"]; };
  const typeOf = (d: DealX) => { const l = dm.get(d.id) ?? []; const ps = l.map((x) => x.content_type ?? "Content type not recorded"); return ps.length ? [...new Set(ps)] : ["Content type not recorded"]; };
  const byPlatform = bucket(platformOf);
  const byContentType = bucket(typeOf);
  const byCategory = bucket((d) => d.category ?? "Uncategorised");
  const byCompany = bucket((d) => d.company_name ?? "Unknown");
  const byAgency = bucket((d) => d.agency_name ?? "Direct (no agency)");
  const bySource = bucket((d) => d.deal_source ?? "Source not recorded");
  const byDealType = bucket((d) => d.deal_type ?? "Type not recorded");
  const cross = bucket((d) => { const l = dm.get(d.id) ?? []; const ps = new Set(l.map((x) => x.platform).filter(Boolean)); if (!l.length) return "Deliverables not recorded"; return ps.size > 1 || l.some((x) => (x.platform ?? "").includes("+")) ? "Cross-platform" : "Single platform"; });
  const usageRev = rec.reduce((s, d) => s + (d.usage_fee ? toReport(d.currency, d.usage_fee) ?? 0 : 0), 0);
  const exclRev = rec.reduce((s, d) => s + (d.exclusivity_fee ? toReport(d.currency, d.exclusivity_fee) ?? 0 : 0), 0);
  // payment speed
  const speeds: number[] = [];
  for (const d of deals) { const from = d.invoice_date ?? d.posting_date; if (from && d.paid_date && d.fin.recognized && d.paid_date >= from) speeds.push(daysBetween(from, d.paid_date)); }
  const avgPay = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : null;
  const dealSizes: Record<string, number[]> = {};
  for (const d of deals) if (d.fin.gross !== null && BOOKED_STAGES.includes(d.stage as any)) (dealSizes[d.currency] ??= []).push(d.fin.gross);
  const avgDealSize = Object.fromEntries(Object.entries(dealSizes).map(([c, a]) => [c, Math.round(a.reduce((x, y) => x + y, 0) / a.length)]));
  const outstanding: Record<string, number> = {};
  for (const d of deals) if (d.fin.outstanding?.amount) addMoney(outstanding, d.fin.outstanding.currency, d.fin.outstanding.amount);
  const total = rec.reduce((s, d) => s + reportable(d), 0);
  const unverified = rec.reduce((s, d) => s + Object.entries(d.fin.unverified).reduce((x, [c, v]) => x + (toReport(c, v) ?? 0), 0), 0);
  return { n: deals.length, recognizedDeals: rec.length, total, unverified, excluded, fxUsed: Object.keys(fx), byYear, byMonth, byPlatform, byContentType, byCategory, byCompany: byCompany.slice(0, 15), byAgency: byAgency.slice(0, 15), bySource, byDealType, cross, usageRev, exclRev, avgPay, paySamples: speeds.length, avgDealSize, outstanding, deals };
}

// ---------------------------------------------------------------- companies / contacts / agencies
export type CompanyRow = { id: string; name: string; company_type: string | null; category: string | null; industry: string | null; website: string | null; country: string | null; city: string | null; headquarters: string | null; size_range: string | null; size_source: string | null; size_source_date: string | null; is_public: number | null; description: string | null; notes: string | null; source: string | null; source_notes: string | null; relationship_status: string | null; contact_count: number; tags: string[]; deals: DealX[]; dealCount: number; lifetime: Record<string, number>; outstanding: Record<string, number>; first: string | null; last: string | null; lastComm: string | null; active: number; avgDeal: number | null; avgCurrency: string; [k: string]: any };
export type AgencyRow = { id: string; name: string; website: string | null; location: string | null; employees_range: string | null; specialty: string | null; notes: string | null; source: string | null; source_notes: string | null; contact_count: number; deals: DealX[]; dealCount: number; lifetime: Record<string, number>; last: string | null; clients: [string, string][]; [k: string]: any };
export type ContactRow = { id: string; full_name: string; first_name: string | null; last_name: string | null; job_title: string | null; company_id: string | null; agency_id: string | null; company_name: string | null; agency_name: string | null; email: string | null; phone: string | null; contact_type: string | null; notes: string | null; source: string | null; source_notes: string | null; tags: string[]; deals: DealX[]; dealCount: number; lifetime: Record<string, number>; lastComm: string | null; lastDeal: string | null; last_contact_effective: string | null; maxOffer: number; [k: string]: any };
export const companyRows = cache(companyRowsUncached) as () => CompanyRow[];
function companyRowsUncached() {
  const deals = loadDeals();
  const comm = all<{ company_id: string | null; company_name: string | null; d: string }>("SELECT company_id, company_name, MAX(date) d FROM communications GROUP BY company_id, company_name");
  const ctags = allTags("company_tags", "company_id");
  const cos = all<any>("SELECT c.*, (SELECT COUNT(*) FROM contacts x WHERE x.company_id = c.id) contact_count FROM companies c WHERE archived = 0 ORDER BY name");
  return cos.map((c) => {
    const ds = deals.filter((d) => d.company_id === c.id);
    const lifetime: Record<string, number> = {}; const out: Record<string, number> = {};
    for (const d of ds) { for (const [cur, v] of Object.entries(d.fin.recognized)) addMoney(lifetime, cur, v); if (d.fin.outstanding?.amount) addMoney(out, d.fin.outstanding.currency, d.fin.outstanding.amount); }
    const dates = ds.map((d) => d.deal_date).filter(Boolean) as string[];
    const lastComm = comm.filter((x) => x.company_id === c.id || x.company_name === c.name).map((x) => x.d).sort().pop() ?? null;
    const gross = ds.filter((d) => d.fin.gross !== null && BOOKED_STAGES.includes(d.stage as any));
    return { ...c, tags: ctags.get(c.id) ?? [], deals: ds, dealCount: ds.length, lifetime, outstanding: out, first: dates.sort()[0] ?? null, last: dates.sort().pop() ?? null, lastComm, active: ds.filter((d) => OPEN_STAGES.includes(d.stage as any)).length, avgDeal: gross.length ? Math.round(gross.reduce((s, d) => s + d.fin.gross!, 0) / gross.length) : null, avgCurrency: gross[0]?.currency ?? "USD" };
  });
}

export const agencyRows = cache(agencyRowsUncached) as () => AgencyRow[];
function agencyRowsUncached() {
  const deals = loadDeals();
  const ags = all<any>("SELECT a.*, (SELECT COUNT(*) FROM contacts x WHERE x.agency_id = a.id) contact_count FROM agencies a WHERE archived = 0 ORDER BY name");
  return ags.map((a) => {
    const ds = deals.filter((d) => d.agency_id === a.id);
    const lifetime: Record<string, number> = {};
    for (const d of ds) for (const [cur, v] of Object.entries(d.fin.recognized)) addMoney(lifetime, cur, v);
    const dates = ds.map((d) => d.deal_date).filter(Boolean) as string[];
    const clients = [...new Map(ds.filter((d) => d.company_id).map((d) => [d.company_id!, d.company_name!])).entries()];
    return { ...a, deals: ds, dealCount: ds.length, lifetime, last: dates.sort().pop() ?? null, clients };
  });
}

export const contactRows = cache(contactRowsUncached) as () => ContactRow[];
function contactRowsUncached() {
  const deals = loadDeals();
  const ctags = allTags("contact_tags", "contact_id");
  const comm = all<{ sender: string; recipient: string; d: string }>("SELECT sender, recipient, date d FROM communications WHERE date IS NOT NULL");
  const cts = all<any>(`SELECT c.*, co.name company_name, a.name agency_name FROM contacts c LEFT JOIN companies co ON co.id = c.company_id LEFT JOIN agencies a ON a.id = c.agency_id WHERE c.archived = 0 ORDER BY full_name`);
  return cts.map((c) => {
    const ds = deals.filter((d) => d.contact_id === c.id);
    const lifetime: Record<string, number> = {};
    for (const d of ds) for (const [cur, v] of Object.entries(d.fin.recognized)) addMoney(lifetime, cur, v);
    const email = (c.email ?? "").toLowerCase();
    const lastComm = email ? comm.filter((m) => `${m.sender} ${m.recipient}`.toLowerCase().includes(email)).map((m) => m.d).sort().pop() ?? null : null;
    const dd = ds.map((d) => d.deal_date).filter(Boolean) as string[];
    const maxOffer = ds.reduce((m, d) => Math.max(m, d.initial_offer ?? 0, d.final_amount ?? 0), 0);
    return { ...c, tags: ctags.get(c.id) ?? [], deals: ds, dealCount: ds.length, lifetime, lastComm, lastDeal: dd.sort().pop() ?? null, last_contact_effective: [c.last_contact, lastComm].filter(Boolean).sort().pop() ?? null, maxOffer };
  });
}

export function dealPayments(dealId: string) { return all<any>("SELECT * FROM payments WHERE deal_id = ? ORDER BY COALESCE(date,'9999')", dealId); }
export function tagsFor(entity: "deal" | "company" | "contact", id: string): string[] {
  return all<{ name: string }>(`SELECT g.name FROM ${entity}_tags t JOIN tags g ON g.id = t.tag_id WHERE t.${entity}_id = ?`, id).map((x) => x.name);
}
export function getDealFull(id: string) {
  const deal = loadDeals().find((d) => d.id === id) ?? null;
  if (!deal) return null;
  const rows = {
    deliverables: all<any>("SELECT * FROM deliverables WHERE deal_id = ? ORDER BY rowid", id),
    usage: all<any>("SELECT * FROM usage_rights WHERE deal_id = ? ORDER BY end_date", id),
    exclusivity: all<any>("SELECT * FROM exclusivity WHERE deal_id = ? ORDER BY end_date", id),
    negotiation: all<any>("SELECT * FROM negotiation_rounds WHERE deal_id = ? ORDER BY seq", id),
    payments: dealPayments(id),
    invoices: all<any>("SELECT * FROM invoices WHERE deal_id = ? ORDER BY issue_date", id),
    expenses: all<any>("SELECT * FROM expenses WHERE deal_id = ? ORDER BY date", id),
    communications: all<any>("SELECT * FROM communications WHERE deal_id = ? ORDER BY COALESCE(date,'9999') DESC", id),
    documents: all<any>("SELECT * FROM documents WHERE deal_id = ? ORDER BY created_at DESC", id),
    tasks: all<any>("SELECT * FROM tasks WHERE deal_id = ? ORDER BY status, COALESCE(due_date,'9999')", id),
    notes: all<any>("SELECT * FROM notes WHERE entity='deal' AND entity_id = ? ORDER BY created_at DESC", id),
    activity: all<any>("SELECT * FROM activity_log WHERE entity='deal' AND entity_id = ? ORDER BY at DESC", id),
    promises: all<any>("SELECT * FROM payment_promises WHERE deal_id = ? ORDER BY date DESC", id),
    contact: deal.contact_id ? get<any>("SELECT * FROM contacts WHERE id = ?", deal.contact_id) : null,
  };
  return { deal, ...rows };
}

export function lastActivity(companyId: string): string | null {
  const a = get<{ d: string | null }>("SELECT MAX(d) d FROM (SELECT MAX(date) d FROM payments p JOIN deals x ON x.id=p.deal_id WHERE x.company_id=? UNION ALL SELECT MAX(COALESCE(posting_date,date_agreed)) FROM deals WHERE company_id=? UNION ALL SELECT MAX(date) FROM communications WHERE company_id=?)", companyId, companyId, companyId);
  return a?.d ?? null;
}
