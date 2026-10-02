import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { all, get, getDb, log, uid } from "./db";
import { loadDeals } from "./queries";
import { parseMoney } from "./format";
import { STAGES } from "./constants";

// ---------------------------------------------------------------- CSV
export function toCSV(rows: Record<string, unknown>[], headers?: string[]): string {
  const cols = headers ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v: unknown) => { if (v === null || v === undefined) return ""; const s = String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\r\n");
}
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = []; let cur: string[] = []; let f = ""; let q = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"') { if (src[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { cur.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && src[i + 1] === "\n") i++; cur.push(f); f = ""; if (cur.some((x) => x !== "")) rows.push(cur); cur = []; }
    else f += c;
  }
  if (f !== "" || cur.length) { cur.push(f); if (cur.some((x) => x !== "")) rows.push(cur); }
  const [h, ...rest] = rows; if (!h) return [];
  const heads = h.map((x) => x.trim());
  return rest.map((r) => Object.fromEntries(heads.map((k, i) => [k, r[i] ?? ""])));
}
export async function parseXLSX(buf: Buffer | ArrayBuffer, sheetName?: string): Promise<Record<string, string>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ws = (sheetName && wb.getWorksheet(sheetName)) || wb.worksheets[0];
  if (!ws) return [];
  const rows: Record<string, string>[] = [];
  let heads: string[] = [];
  ws.eachRow((row, n) => {
    const vals = (row.values as any[]).slice(1).map((v) => (v && typeof v === "object" && "result" in v ? v.result : v instanceof Date ? v.toISOString().slice(0, 10) : v && typeof v === "object" && "text" in v ? v.text : v));
    if (n === 1) heads = vals.map((x) => String(x ?? "").trim());
    else rows.push(Object.fromEntries(heads.map((k, i) => [k, vals[i] === null || vals[i] === undefined ? "" : String(vals[i])])));
  });
  return rows;
}

// ---------------------------------------------------------------- export rows
const dec = (v: number | null) => (v === null || v === undefined ? "" : (v / 100).toFixed(2));
export type ExportKind = "deals" | "contacts" | "companies" | "revenue" | "invoices" | "communications" | "tasks";
export const EXPORT_KINDS: ExportKind[] = ["deals", "contacts", "companies", "revenue", "invoices", "communications", "tasks"];

export function exportRows(kind: ExportKind, filter?: (d: any) => boolean): Record<string, unknown>[] {
  if (kind === "deals") {
    let deals = loadDeals(); if (filter) deals = deals.filter(filter);
    return deals.map((d) => ({
      deal_id: d.id, deal_name: d.name, company: d.company_name, agency: d.agency_name, contact: d.contact_name, stage: d.stage, status: d.status, deal_type: d.deal_type, category: d.category, deal_source: d.deal_source, tags: d.tags.join("; "),
      currency: d.currency, initial_offer: dec(d.initial_offer), counter_offer: dec(d.counter_offer), final_agreed_amount: dec(d.final_amount), product_value: dec(d.product_value), usage_fee: dec(d.usage_fee), exclusivity_fee: dec(d.exclusivity_fee), whitelisting_fee: dec(d.whitelisting_fee), licensing_fee: dec(d.licensing_fee), affiliate_commission: dec(d.affiliate_commission),
      total_gross_revenue: dec(d.fin.gross), amount_paid_same_currency: dec(d.fin.paidSameCurrency), amount_outstanding: d.fin.outstanding?.amount === null ? "" : d.fin.outstanding ? dec(d.fin.outstanding.amount) : "", outstanding_currency: d.fin.outstanding?.currency ?? "",
      payment_state: d.payment_state, payment_evidence: d.payment_verification, payment_terms: d.payment_terms, last_payment_date: d.paid_date, invoice_date: d.invoice_date,
      date_received: d.date_received, date_contacted: d.date_contacted, date_negotiated: d.date_negotiated, date_agreed: d.date_agreed, contract_date: d.contract_date, campaign_date: d.campaign_date, posting_date: d.posting_date, completion_date: d.completion_date,
      next_action: d.next_action, next_followup: d.next_followup, source: d.source, source_notes: d.source_notes, original_source: d.original_source, field_status: d.field_status,
    }));
  }
  if (kind === "contacts") return all<any>("SELECT c.*, co.name company, a.name agency FROM contacts c LEFT JOIN companies co ON co.id=c.company_id LEFT JOIN agencies a ON a.id=c.agency_id WHERE c.archived=0").map((c) => ({ contact_id: c.id, full_name: c.full_name, first_name: c.first_name, last_name: c.last_name, job_title: c.job_title, company: c.company, agency: c.agency, email: c.email, phone: c.phone, linkedin: c.linkedin, instagram: c.instagram, location: c.location, country: c.country, department: c.department, contact_type: c.contact_type, relationship_status: c.relationship_status, preferred_communication: c.preferred_communication, first_contact: c.first_contact, last_contact: c.last_contact, notes: c.notes, source: c.source, source_notes: c.source_notes }));
  if (kind === "companies") return all<any>("SELECT * FROM companies WHERE archived=0").map((c) => ({ company_id: c.id, name: c.name, company_type: c.company_type, category: c.category, industry: c.industry, website: c.website, country: c.country, city: c.city, headquarters: c.headquarters, size_range: c.size_range, size_source: c.size_source, size_source_date: c.size_source_date, is_public: c.is_public, description: c.description, instagram: c.instagram, tiktok: c.tiktok, youtube: c.youtube, linkedin: c.linkedin, notes: c.notes, source: c.source, source_notes: c.source_notes }));
  if (kind === "revenue") return all<any>("SELECT p.*, d.name deal_name FROM payments p LEFT JOIN deals d ON d.id=p.deal_id ORDER BY date").map((p) => ({ payment_id: p.id, date: p.date, deal: p.deal_name, deal_id: p.deal_id, invoice_id: p.invoice_id, amount: dec(p.amount), currency: p.currency, method: p.method, reference: p.reference, payer: p.payer, verified: p.verified ? "yes" : "no", source: p.source, source_notes: p.source_notes }));
  if (kind === "invoices") return all<any>("SELECT i.*, c.name company FROM invoices i LEFT JOIN companies c ON c.id=i.company_id ORDER BY issue_date").map((i) => ({ invoice_id: i.id, number: i.number, company: i.company, deal_id: i.deal_id, issue_date: i.issue_date, due_date: i.due_date, amount: dec(i.amount), currency: i.currency, status: i.status, terms: i.terms, description: i.description, source: i.source, source_notes: i.source_notes }));
  if (kind === "communications") return all<any>("SELECT id, thread_id, date, direction, sender, recipient, subject, snippet, company_name, deal_id, classification, priority, extraction_status, source FROM communications ORDER BY date");
  return all<any>("SELECT * FROM tasks");
}

export async function buildWorkbook(kinds: ExportKind[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook(); wb.creator = "Nolan OS"; wb.created = new Date();
  for (const k of kinds) {
    const rows = exportRows(k);
    const ws = wb.addWorksheet(k[0].toUpperCase() + k.slice(1), { views: [{ state: "frozen", ySplit: 1 }] });
    const cols = rows.length ? Object.keys(rows[0]) : ["(empty)"];
    ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.min(40, Math.max(12, c.length + 2)) }));
    ws.getRow(1).font = { bold: true };
    for (const r of rows) ws.addRow(r);
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------------------------------------------------------------- backup / restore
const TABLES = ["users", "settings", "companies", "agencies", "contacts", "campaigns", "deals", "negotiation_rounds", "deliverables", "invoices", "invoice_items", "payments", "expenses", "usage_rights", "exclusivity", "communications", "payment_promises", "documents", "tasks", "notes", "tags", "deal_tags", "company_tags", "contact_tags", "activity_log", "rate_cards", "rate_card_items", "revenue_other", "attention_state", "review_queue", "duplicate_reviews", "ignore_rules", "notification_rules", "import_log"];
export function backupJSON() {
  const out: Record<string, unknown> = { app: "nolan-os", format: 1, exported_at: new Date().toISOString() };
  for (const t of TABLES) out[t] = all<any>(`SELECT * FROM ${t}`);
  return out;
}
export function snapshotDb(): string {
  const dir = path.join(process.cwd(), "data", "backups"); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `pre-restore-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(backupJSON()));
  return file;
}
export function restoreJSON(data: any, replace: boolean): { tables: Record<string, number>; snapshot?: string } {
  if (data?.app !== "nolan-os") throw new Error("This file is not a Nolan OS backup.");
  const db = getDb();
  let snapshot: string | undefined;
  if (replace) snapshot = snapshotDb();
  const counts: Record<string, number> = {};
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      if (replace) for (const t of [...TABLES].reverse()) db.prepare(`DELETE FROM ${t}`).run();
      for (const t of TABLES) {
        const rows: any[] = data[t] ?? []; counts[t] = 0;
        for (const r of rows) {
          const cols = Object.keys(r); if (!cols.length) continue;
          const info = db.prepare(`INSERT OR ${replace ? "REPLACE" : "IGNORE"} INTO ${t} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(...cols.map((c) => r[c]));
          counts[t] += info.changes;
        }
      }
    })();
  } finally { db.pragma("foreign_keys = ON"); }
  db.prepare("INSERT INTO import_log (id, at, kind, summary, detail) VALUES (?,?,?,?,?)").run(uid("im"), new Date().toISOString(), "restore", replace ? "Restored backup (replace)" : "Restored backup (merge)", JSON.stringify(counts));
  return { tables: counts, snapshot };
}

// ---------------------------------------------------------------- import
const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");
function pick(r: Record<string, string>, ...names: string[]): string | null {
  const m = new Map(Object.entries(r).map(([k, v]) => [norm(k), v]));
  for (const n of names) { const v = m.get(norm(n)); if (v !== undefined && String(v).trim() !== "") return String(v).trim(); }
  return null;
}
const isoDate = (v: string | null) => { if (!v) return null; const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`; const d = new Date(v); return isNaN(+d) ? null : d.toISOString().slice(0, 10); };

export function importRows(kind: string, rows: Record<string, string>[], filename: string) {
  const db = getDb();
  let inserted = 0, skipped = 0; const errors: string[] = [];
  const co = (name: string | null) => { if (!name) return null; const h = get<{ id: string }>("SELECT id FROM companies WHERE LOWER(name)=LOWER(?) AND archived=0", name); if (h) return h.id; const id = uid("co"); db.prepare("INSERT INTO companies (id,name,source,source_notes) VALUES (?,?,?,?)").run(id, name, "import", `Imported from ${filename}`); return id; };
  const ag = (name: string | null) => { if (!name) return null; const h = get<{ id: string }>("SELECT id FROM agencies WHERE LOWER(name)=LOWER(?) AND archived=0", name); if (h) return h.id; const id = uid("ag"); db.prepare("INSERT INTO agencies (id,name,source) VALUES (?,?,?)").run(id, name, "import"); return id; };
  db.transaction(() => {
    rows.forEach((r, i) => {
      try {
        if (kind === "deals") {
          const name = pick(r, "deal_name", "name", "deal", "campaign"); const company = pick(r, "company", "brand");
          if (!name && !company) { skipped++; errors.push(`Row ${i + 2}: no deal name or company`); return; }
          const stage = pick(r, "stage", "status"); const st = STAGES.find((s) => s.toLowerCase() === (stage ?? "").toLowerCase()) ?? "Lead";
          const id = pick(r, "deal_id", "id") ?? uid("dl");
          if (get("SELECT 1 FROM deals WHERE id = ?", id)) { skipped++; return; }
          const m = (...n: string[]) => parseMoney(pick(r, ...n));
          db.prepare(`INSERT INTO deals (id,name,company_id,agency_id,stage,status,currency,initial_offer,counter_offer,final_amount,product_value,payment_terms,payment_state,deal_source,category,date_received,date_agreed,posting_date,invoice_date,source,source_notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .run(id, name ?? company, co(company), ag(pick(r, "agency")), st, "open", (pick(r, "currency") ?? "USD").toUpperCase(), m("initial_offer", "offer"), m("counter_offer", "counter"), m("final_agreed_amount", "final_amount", "amount", "fee"), m("product_value"), pick(r, "payment_terms", "terms"), "n/a", pick(r, "deal_source", "source"), pick(r, "category"), isoDate(pick(r, "date_received")), isoDate(pick(r, "date_agreed")), isoDate(pick(r, "posting_date")), isoDate(pick(r, "invoice_date")), "import", `Imported from ${filename}, row ${i + 2}. ${pick(r, "notes", "source_notes") ?? ""}`.trim());
          log("deal", id, "import", `Imported from ${filename}`); inserted++;
        } else if (kind === "contacts") {
          const full = pick(r, "full_name", "name"); if (!full) { skipped++; return; }
          const email = pick(r, "email");
          if (email && get("SELECT 1 FROM contacts WHERE LOWER(email)=LOWER(?)", email)) { skipped++; return; }
          const [first, ...rest] = full.split(" ");
          db.prepare("INSERT INTO contacts (id,full_name,first_name,last_name,job_title,company_id,agency_id,email,phone,contact_type,notes,source,source_notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").run(pick(r, "contact_id", "id") ?? uid("ct"), full, first, rest.join(" ") || null, pick(r, "job_title", "title"), co(pick(r, "company")), ag(pick(r, "agency")), email, pick(r, "phone"), pick(r, "contact_type", "type"), pick(r, "notes"), "import", `Imported from ${filename}`); inserted++;
        } else if (kind === "companies") {
          const name = pick(r, "name", "company"); if (!name) { skipped++; return; }
          if (get("SELECT 1 FROM companies WHERE LOWER(name)=LOWER(?)", name)) { skipped++; return; }
          db.prepare("INSERT INTO companies (id,name,company_type,category,industry,website,country,size_range,size_source,size_source_date,notes,source,source_notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").run(pick(r, "company_id", "id") ?? uid("co"), name, pick(r, "company_type", "type"), pick(r, "category"), pick(r, "industry"), pick(r, "website"), pick(r, "country"), pick(r, "size_range", "size"), pick(r, "size_source"), isoDate(pick(r, "size_source_date")), pick(r, "notes"), "import", `Imported from ${filename}`); inserted++;
        } else if (kind === "communications") {
          const subject = pick(r, "subject"); const body = pick(r, "body", "text", "snippet");
          if (!subject && !body) { skipped++; return; }
          db.prepare("INSERT INTO communications (id,thread_id,date,direction,sender,recipient,subject,snippet,body,company_name,classification,extraction_status,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").run(pick(r, "id") ?? uid("cm"), pick(r, "thread_id", "thread") ?? uid("th"), isoDate(pick(r, "date")), (pick(r, "direction") ?? "in"), pick(r, "from", "sender"), pick(r, "to", "recipient"), subject, (body ?? "").slice(0, 300), body, pick(r, "company", "company_name"), pick(r, "classification"), "Not analysed", "import"); inserted++;
        } else { skipped++; errors.push(`Unknown import kind ${kind}`); }
      } catch (e: any) { skipped++; errors.push(`Row ${i + 2}: ${e.message}`); }
    });
  })();
  db.prepare("INSERT INTO import_log (id, at, kind, summary, detail) VALUES (?,?,?,?,?)").run(uid("im"), new Date().toISOString(), `import:${kind}`, `${filename}: ${inserted} added, ${skipped} skipped`, JSON.stringify(errors.slice(0, 50)));
  return { inserted, skipped, errors: errors.slice(0, 20) };
}
