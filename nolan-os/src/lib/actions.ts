"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { all, get, getDb, getSetting, log, run, setSetting, uid } from "./db";
import { gross } from "./calc";
import { exclusivityConflicts } from "./attention";
import { classifyEmail, detectPaymentPromise, extractDeal, suspiciousSignals } from "./intel";
import { addDays, parseMoney, today } from "./format";
import { STAGES } from "./constants";
import { nextInvoiceNumber } from "./invoice";

export type ActionState = { ok?: boolean; error?: string; warnings?: string[]; id?: string } | null;

const S = (fd: FormData, k: string) => { const v = fd.get(k); const s = typeof v === "string" ? v.trim() : ""; return s || null; };
const M = (fd: FormData, k: string) => parseMoney(S(fd, k));
const D = (fd: FormData, k: string) => { const v = S(fd, k); return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; };
const N = (fd: FormData, k: string) => { const v = S(fd, k); return v && isFinite(+v) ? +v : null; };
const refresh = () => revalidatePath("/", "layout");

// ---------------------------------------------------------------- helpers
async function ensureCompany(name: string | null, extra: Record<string, any> = {}): Promise<string | null> {
  if (!name) return null;
  const hit = get<{ id: string }>("SELECT id FROM companies WHERE LOWER(name) = LOWER(?) AND archived = 0", name);
  if (hit) return hit.id;
  const id = uid("co");
  run("INSERT INTO companies (id, name, company_type, category, source, source_notes) VALUES (?,?,?,?,?,?)", id, name, extra.company_type ?? null, extra.category ?? null, extra.source ?? "manual", extra.source_notes ?? null);
  log("company", id, "create", `Created ${name}`);
  return id;
}
async function ensureAgency(name: string | null): Promise<string | null> {
  if (!name) return null;
  const hit = get<{ id: string }>("SELECT id FROM agencies WHERE LOWER(name) = LOWER(?) AND archived = 0", name);
  if (hit) return hit.id;
  const id = uid("ag");
  run("INSERT INTO agencies (id, name, source) VALUES (?,?,?)", id, name, "manual");
  return id;
}

function recomputePayment(dealId: string) {
  const d = get<any>("SELECT * FROM deals WHERE id = ?", dealId);
  if (!d) return;
  const g = gross(d);
  const paid = all<any>("SELECT amount FROM payments WHERE deal_id = ? AND currency = ? AND amount IS NOT NULL", dealId, d.currency).reduce((s, p) => s + p.amount, 0);
  const any = get<any>("SELECT COUNT(*) c FROM payments WHERE deal_id = ?", dealId).c > 0;
  let state = d.payment_state;
  if (any) {
    if (g !== null && paid >= g && g > 0) state = "paid";
    else if (g !== null && paid > 0) state = "partial";
    else if (g === null) state = d.payment_state === "paid" ? "paid" : "partial";
  }
  run("UPDATE deals SET payment_state = ?, updated_at = datetime('now') WHERE id = ?", state, dealId);
  if (state === "paid" && d.stage !== "Paid" && ["Content delivered", "Invoice sent", "Production", "Contract signed"].includes(d.stage)) run("UPDATE deals SET stage = 'Paid', status = 'closed' WHERE id = ?", dealId);
}

// ---------------------------------------------------------------- deals
export async function createDeal(_: ActionState, fd: FormData): Promise<ActionState> {
  const company = S(fd, "company");
  if (!company) return { error: "Company is required." };
  const name = S(fd, "name") ?? `${company}${S(fd, "campaign") ? " - " + S(fd, "campaign") : ""}`;
  const companyId = await ensureCompany(company, { category: S(fd, "category") });
  const agencyId = await ensureAgency(S(fd, "agency"));
  const cat = S(fd, "category");
  const warnings = exclusivityConflicts({ category: cat, competitor: company }).map((c) => c.text);
  if (warnings.length && getSetting<any>("behaviour", {}).blockExclusivityConflicts && fd.get("override") !== "yes") return { error: "Blocked by your exclusivity setting. Tick 'Proceed anyway' to continue.", warnings };
  const id = uid("dl");
  let campaignId: string | null = null;
  const camp = S(fd, "campaign");
  if (camp) { campaignId = uid("cm"); run("INSERT INTO campaigns (id, company_id, agency_id, name, source) VALUES (?,?,?,?,?)", campaignId, companyId, agencyId, camp, "manual"); }
  run(`INSERT INTO deals (id, name, company_id, agency_id, campaign_id, stage, status, deal_source, deal_type, category, currency, initial_offer, final_amount, payment_terms, payment_state, date_received, next_action, next_followup, source, source_notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, name, companyId, agencyId, campaignId, S(fd, "stage") ?? "Lead", "open", S(fd, "deal_source"), S(fd, "deal_type"), cat, S(fd, "currency") ?? "USD", M(fd, "offer"), M(fd, "amount"), S(fd, "terms"), "n/a", D(fd, "received") ?? today(), S(fd, "next_action"), D(fd, "next_followup"), "manual", S(fd, "notes"));
  log("deal", id, "create", `Created deal ${name}`);
  refresh();
  if (fd.get("redirect") !== "no") redirect(`/deals/${id}`);
  return { ok: true, id, warnings };
}

export async function updateDeal(fd: FormData) {
  const id = S(fd, "id")!;
  const fields: Record<string, any> = {};
  const money = ["initial_offer", "counter_offer", "final_amount", "product_value", "production_budget", "travel_budget", "crew_budget", "talent_budget", "usage_fee", "exclusivity_fee", "whitelisting_fee", "licensing_fee", "affiliate_commission"];
  const text = ["name", "deal_source", "deal_type", "client_type", "category", "payment_terms", "next_action", "currency", "source_notes"];
  const dates = ["date_received", "date_contacted", "date_negotiated", "date_agreed", "contract_date", "campaign_date", "posting_date", "completion_date", "invoice_date", "next_followup"];
  for (const k of money) if (fd.has(k)) fields[k] = M(fd, k);
  for (const k of text) if (fd.has(k)) fields[k] = S(fd, k);
  for (const k of dates) if (fd.has(k)) fields[k] = D(fd, k);
  if (fd.has("company")) fields.company_id = await ensureCompany(S(fd, "company"));
  if (fd.has("agency")) fields.agency_id = await ensureAgency(S(fd, "agency"));
  if (!Object.keys(fields).length) return;
  const old = get<any>("SELECT * FROM deals WHERE id = ?", id);
  const sets = Object.keys(fields).map((k) => `${k} = ?`).join(", ");
  run(`UPDATE deals SET ${sets}, updated_at = datetime('now') WHERE id = ?`, ...Object.values(fields), id);
  const fs = JSON.parse(old.field_status ?? "{}");
  for (const k of Object.keys(fields)) fs[k] = "confirmed";
  run("UPDATE deals SET field_status = ? WHERE id = ?", JSON.stringify(fs), id);
  const changed = Object.keys(fields).filter((k) => String(fields[k] ?? "") !== String(old[k] ?? ""));
  if (changed.length) log("deal", id, "edit", `Edited ${changed.join(", ")}`);
  recomputePayment(id);
  refresh();
}

export async function setStage(fd: FormData) {
  const id = S(fd, "id")!; const stage = S(fd, "stage")!;
  if (!STAGES.includes(stage as any)) return;
  const old = get<any>("SELECT stage, payment_state FROM deals WHERE id = ?", id);
  if (!old || old.stage === stage) return;
  const sets: string[] = ["stage = ?", "status = ?", "updated_at = datetime('now')"]; const args: any[] = [stage, ["Paid", "Lost", "Archived"].includes(stage) ? "closed" : "open"];
  const t = today();
  const dateCol: Record<string, string> = { Contacted: "date_contacted", Negotiating: "date_negotiated", Agreed: "date_agreed", "Contract signed": "contract_date", "Content delivered": "completion_date", "Invoice sent": "invoice_date" };
  if (dateCol[stage] && !get<any>(`SELECT ${dateCol[stage]} v FROM deals WHERE id = ?`, id).v) { sets.push(`${dateCol[stage]} = ?`); args.push(t); }
  if (stage === "Paid") { sets.push("payment_state = 'paid'", "payment_verification = 'manual'"); }
  run(`UPDATE deals SET ${sets.join(", ")} WHERE id = ?`, ...args, id);
  log("deal", id, "stage", `Stage: ${old.stage} → ${stage}`);
  refresh();
}

export async function addNote(fd: FormData) {
  const body = S(fd, "body"); if (!body) return;
  const entity = S(fd, "entity")!, eid = S(fd, "entity_id")!;
  run("INSERT INTO notes (id, entity, entity_id, body, source) VALUES (?,?,?,?,?)", uid("nt"), entity, eid, body, "manual");
  log(entity, eid, "note", "Added a note", body.slice(0, 200));
  refresh();
}

export async function addPayment(fd: FormData) {
  const dealId = S(fd, "deal_id"); const invoiceId = S(fd, "invoice_id");
  const amount = M(fd, "amount");
  const cur = S(fd, "currency") ?? get<any>("SELECT currency FROM deals WHERE id = ?", dealId)?.currency ?? "USD";
  let did = dealId;
  if (!did && invoiceId) did = get<any>("SELECT deal_id FROM invoices WHERE id = ?", invoiceId)?.deal_id ?? null;
  if (amount === null) return;
  const id = uid("py");
  run("INSERT INTO payments (id, deal_id, invoice_id, date, amount, currency, method, reference, payer, verified, notes, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", id, did, invoiceId, D(fd, "date") ?? today(), amount, cur, S(fd, "method"), S(fd, "reference"), S(fd, "payer"), 1, S(fd, "notes"), "manual");
  if (did) {
    run("UPDATE deals SET manual_outstanding = NULL, manual_outstanding_currency = NULL, manual_outstanding_note = NULL, payment_verification = 'manual' WHERE id = ?", did);
    if (fd.get("settles") === "yes") run("UPDATE deals SET payment_state = 'paid', stage = 'Paid', status = 'closed' WHERE id = ?", did);
    else recomputePayment(did);
    log("deal", did, "payment", `Payment recorded: ${(amount / 100).toFixed(2)} ${cur}`, S(fd, "reference") ?? undefined);
  }
  if (invoiceId) syncInvoiceStatus(invoiceId);
  refresh();
}

export async function addDeliverable(fd: FormData) {
  const dealId = S(fd, "deal_id")!;
  run("INSERT INTO deliverables (id, deal_id, platform, content_type, quantity, deadline, published_date, status, url, notes) VALUES (?,?,?,?,?,?,?,?,?,?)", uid("dv"), dealId, S(fd, "platform"), S(fd, "content_type"), N(fd, "quantity"), D(fd, "deadline"), D(fd, "published_date"), S(fd, "status") ?? "Planned", S(fd, "url"), S(fd, "notes"));
  log("deal", dealId, "deliverable", `Added deliverable ${S(fd, "content_type") ?? ""}`);
  refresh();
}
export async function setDeliverableStatus(fd: FormData) {
  const id = S(fd, "id")!; const status = S(fd, "status")!;
  run("UPDATE deliverables SET status = ?, published_date = CASE WHEN ? IN ('Published','Delivered') AND published_date IS NULL THEN ? ELSE published_date END WHERE id = ?", status, status, today(), id);
  refresh();
}

export async function addUsage(fd: FormData) {
  const dealId = S(fd, "deal_id")!;
  run("INSERT INTO usage_rights (id, deal_id, kind, start_date, end_date, territory, platforms, duration, fee, currency, notes, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", uid("us"), dealId, S(fd, "kind") ?? "Paid usage", D(fd, "start_date"), D(fd, "end_date"), S(fd, "territory"), S(fd, "platforms"), S(fd, "duration"), M(fd, "fee"), S(fd, "currency") ?? "USD", S(fd, "notes"), "manual");
  log("deal", dealId, "usage", `Added usage right: ${S(fd, "kind")}`);
  refresh();
}

export async function addExclusivity(fd: FormData) {
  const dealId = S(fd, "deal_id")!;
  const cat = S(fd, "competitor_category");
  run("INSERT INTO exclusivity (id, deal_id, competitor_category, competitors, start_date, end_date, duration, fee, currency, notes, source) VALUES (?,?,?,?,?,?,?,?,?,?,?)", uid("ex"), dealId, cat, S(fd, "competitors"), D(fd, "start_date"), D(fd, "end_date"), S(fd, "duration"), M(fd, "fee"), S(fd, "currency") ?? "USD", S(fd, "notes"), "manual");
  log("deal", dealId, "exclusivity", `Added exclusivity: ${cat ?? ""}`);
  refresh();
}

export async function addNegotiation(fd: FormData) {
  const dealId = S(fd, "deal_id")!;
  const seq = (get<any>("SELECT COALESCE(MAX(seq),0)+1 n FROM negotiation_rounds WHERE deal_id = ?", dealId)).n;
  const amount = M(fd, "amount");
  run("INSERT INTO negotiation_rounds (id, deal_id, seq, party, kind, amount, currency, date, confirmed, note) VALUES (?,?,?,?,?,?,?,?,1,?)", uid("ng"), dealId, seq, S(fd, "party"), S(fd, "kind"), amount, S(fd, "currency") ?? "USD", D(fd, "date") ?? today(), S(fd, "note"));
  if (S(fd, "kind") === "final" && amount !== null) run("UPDATE deals SET final_amount = ? WHERE id = ?", amount, dealId);
  if (S(fd, "kind") === "offer" && amount !== null) run("UPDATE deals SET initial_offer = COALESCE(initial_offer, ?) WHERE id = ?", amount, dealId);
  log("deal", dealId, "negotiation", `${S(fd, "party")} ${S(fd, "kind")}: ${amount === null ? "?" : amount / 100}`);
  refresh();
}

export async function addExpense(fd: FormData) {
  const amount = M(fd, "amount"); if (amount === null) return;
  const dealId = S(fd, "deal_id");
  run("INSERT INTO expenses (id, deal_id, date, category, description, amount, currency, vendor, notes, source) VALUES (?,?,?,?,?,?,?,?,?,?)", uid("xp"), dealId, D(fd, "date") ?? today(), S(fd, "category"), S(fd, "description"), amount, S(fd, "currency") ?? "USD", S(fd, "vendor"), S(fd, "notes"), "manual");
  if (dealId) log("deal", dealId, "expense", `Expense ${S(fd, "category") ?? ""}: ${(amount / 100).toFixed(2)}`);
  refresh();
}

export async function setFollowup(fd: FormData) {
  const id = S(fd, "id")!;
  run("UPDATE deals SET next_action = ?, next_followup = ?, reminder = ? WHERE id = ?", S(fd, "next_action"), D(fd, "next_followup"), S(fd, "reminder"), id);
  log("deal", id, "followup", `Next action: ${S(fd, "next_action") ?? "cleared"}${D(fd, "next_followup") ? " on " + D(fd, "next_followup") : ""}`);
  refresh();
}

export async function toggleTag(fd: FormData) {
  const entity = S(fd, "entity") as "deal" | "company" | "contact"; const id = S(fd, "id")!; const name = S(fd, "tag"); if (!name) return;
  let tag = get<any>("SELECT id FROM tags WHERE LOWER(name) = LOWER(?)", name);
  if (!tag) { const tid = uid("tg"); run("INSERT INTO tags (id, name) VALUES (?,?)", tid, name); tag = { id: tid }; }
  const has = get<any>(`SELECT 1 x FROM ${entity}_tags WHERE ${entity}_id = ? AND tag_id = ?`, id, tag.id);
  if (has) run(`DELETE FROM ${entity}_tags WHERE ${entity}_id = ? AND tag_id = ?`, id, tag.id);
  else run(`INSERT INTO ${entity}_tags (${entity}_id, tag_id) VALUES (?,?)`, id, tag.id);
  refresh();
}

export async function archiveDeal(fd: FormData) {
  if (fd.get("confirm") !== "yes") return;
  const id = S(fd, "id")!;
  run("UPDATE deals SET archived = 1, stage = 'Archived' WHERE id = ?", id);
  log("deal", id, "archive", "Archived deal (kept in database, hidden from lists)");
  refresh();
  redirect("/deals");
}

// ---------------------------------------------------------------- companies / contacts / agencies
export async function createCompany(_: ActionState, fd: FormData): Promise<ActionState> {
  const name = S(fd, "name"); if (!name) return { error: "Company name is required." };
  if (get("SELECT 1 FROM companies WHERE LOWER(name)=LOWER(?) AND archived=0", name) && fd.get("override") !== "yes") return { error: "A company with this name already exists. Open it from Companies, or tick 'Create anyway'." };
  const id = uid("co");
  run("INSERT INTO companies (id, name, company_type, category, website, country, source) VALUES (?,?,?,?,?,?,?)", id, name, S(fd, "company_type"), S(fd, "category"), S(fd, "website"), S(fd, "country"), "manual");
  log("company", id, "create", `Created ${name}`);
  refresh();
  if (fd.get("redirect") !== "no") redirect(`/companies/${id}`);
  return { ok: true, id };
}
export async function updateCompany(fd: FormData) {
  const id = S(fd, "id")!;
  const cols = ["name", "industry", "category", "company_type", "website", "country", "city", "headquarters", "size_range", "size_source", "size_source_date", "description", "instagram", "tiktok", "youtube", "linkedin", "relationship_status", "notes"];
  const sets: string[] = []; const args: any[] = [];
  for (const c of cols) if (fd.has(c)) { sets.push(`${c} = ?`); args.push(S(fd, c)); }
  if (fd.has("is_public")) { sets.push("is_public = ?"); args.push(fd.get("is_public") === "" ? null : fd.get("is_public") === "1" ? 1 : 0); }
  if (fd.has("parent_company")) { sets.push("parent_company_id = ?"); args.push(await ensureCompany(S(fd, "parent_company"))); }
  if (!sets.length) return;
  if (fd.has("size_range") && S(fd, "size_range") && !S(fd, "size_source")) { /* size without a source is allowed but flagged in the UI */ }
  run(`UPDATE companies SET ${sets.join(", ")} WHERE id = ?`, ...args, id);
  log("company", id, "edit", "Edited company details");
  refresh();
}
export async function createContact(_: ActionState, fd: FormData): Promise<ActionState> {
  const full = S(fd, "full_name"); if (!full) return { error: "Name is required." };
  const [first, ...rest] = full.split(" ");
  const companyId = await ensureCompany(S(fd, "company")); const agencyId = await ensureAgency(S(fd, "agency"));
  const id = uid("ct");
  run("INSERT INTO contacts (id, full_name, first_name, last_name, job_title, company_id, agency_id, email, phone, contact_type, source) VALUES (?,?,?,?,?,?,?,?,?,?,?)", id, full, first, rest.join(" ") || null, S(fd, "job_title"), companyId, agencyId, S(fd, "email"), S(fd, "phone"), S(fd, "contact_type"), "manual");
  refresh();
  if (fd.get("redirect") !== "no") redirect(`/contacts/${id}`);
  return { ok: true, id };
}
export async function updateContact(fd: FormData) {
  const id = S(fd, "id")!;
  const cols = ["full_name", "first_name", "last_name", "job_title", "email", "phone", "linkedin", "instagram", "location", "country", "department", "contact_type", "relationship_status", "preferred_communication", "first_contact", "last_contact", "notes"];
  const sets: string[] = []; const args: any[] = [];
  for (const c of cols) if (fd.has(c)) { sets.push(`${c} = ?`); args.push(S(fd, c)); }
  if (fd.has("company")) { sets.push("company_id = ?"); args.push(await ensureCompany(S(fd, "company"))); }
  if (fd.has("agency")) { sets.push("agency_id = ?"); args.push(await ensureAgency(S(fd, "agency"))); }
  if (sets.length) run(`UPDATE contacts SET ${sets.join(", ")} WHERE id = ?`, ...args, id);
  refresh();
}
export async function createAgency(_: ActionState, fd: FormData): Promise<ActionState> {
  const name = S(fd, "name"); if (!name) return { error: "Agency name is required." };
  const id = uid("ag");
  run("INSERT INTO agencies (id, name, website, location, specialty, source) VALUES (?,?,?,?,?,?)", id, name, S(fd, "website"), S(fd, "location"), S(fd, "specialty"), "manual");
  refresh();
  if (fd.get("redirect") !== "no") redirect(`/agencies/${id}`);
  return { ok: true, id };
}
export async function updateAgency(fd: FormData) {
  const id = S(fd, "id")!;
  const cols = ["name", "website", "location", "employees_range", "specialty", "notes"];
  const sets: string[] = []; const args: any[] = [];
  for (const c of cols) if (fd.has(c)) { sets.push(`${c} = ?`); args.push(S(fd, c)); }
  if (sets.length) run(`UPDATE agencies SET ${sets.join(", ")} WHERE id = ?`, ...args, id);
  refresh();
}

// ---------------------------------------------------------------- tasks
export async function createTask(_: ActionState, fd: FormData): Promise<ActionState> {
  const title = S(fd, "title"); if (!title) return { error: "Describe the task." };
  run("INSERT INTO tasks (id, deal_id, company_id, title, due_date, kind, priority, source) VALUES (?,?,?,?,?,?,?,?)", uid("tk"), S(fd, "deal_id"), S(fd, "company_id"), title, D(fd, "due_date"), S(fd, "kind") ?? "task", S(fd, "priority") ?? "medium", "manual");
  refresh();
  return { ok: true };
}
export async function completeTask(fd: FormData) {
  run("UPDATE tasks SET status = 'done', completed_at = datetime('now') WHERE id = ?", S(fd, "id")!);
  refresh();
}
export async function reopenTask(fd: FormData) { run("UPDATE tasks SET status = 'open', completed_at = NULL WHERE id = ?", S(fd, "id")!); refresh(); }
export async function snoozeTask(fd: FormData) {
  const days = N(fd, "days") ?? 3;
  run("UPDATE tasks SET snoozed_until = ?, due_date = COALESCE(due_date, ?) WHERE id = ?", addDays(today(), days), addDays(today(), days), S(fd, "id")!);
  refresh();
}
export async function setTaskDate(fd: FormData) { run("UPDATE tasks SET due_date = ? WHERE id = ?", D(fd, "due_date"), S(fd, "id")!); refresh(); }

// ---------------------------------------------------------------- attention
export async function attentionAction(fd: FormData) {
  const key = S(fd, "key")!; const act = S(fd, "act")!;
  if (act === "task") {
    const title = S(fd, "title") ?? key;
    run("INSERT INTO tasks (id, deal_id, title, due_date, kind, source) VALUES (?,?,?,?,?,?)", uid("tk"), S(fd, "deal_id"), title, addDays(today(), 1), "follow-up", "attention");
    run("INSERT INTO attention_state (key, state, until) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET state = excluded.state, until = excluded.until, updated_at = datetime('now')", key, "snoozed", addDays(today(), 1));
  } else {
    const state = act === "snooze" ? "snoozed" : act === "ignore" ? "ignored" : "handled";
    const until = act === "snooze" ? addDays(today(), N(fd, "days") ?? 3) : null;
    run("INSERT INTO attention_state (key, state, until) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET state = excluded.state, until = excluded.until, updated_at = datetime('now')", key, state, until);
    if (key.startsWith("thread:")) run("UPDATE communications SET handled = 1 WHERE thread_id = ?", key.slice(7));
    if (key.startsWith("promise:") && act === "handled") run("UPDATE payment_promises SET status = 'closed' WHERE id = ?", key.slice(8));
    if (key.startsWith("task:") && act === "handled") run("UPDATE tasks SET status='done', completed_at = datetime('now') WHERE id = ?", key.slice(5));
  }
  refresh();
}
export async function resetAttentionHidden() { run("DELETE FROM attention_state"); refresh(); }

// ---------------------------------------------------------------- invoices
export async function createInvoice(_: ActionState, fd: FormData): Promise<ActionState> {
  const dealId = S(fd, "deal_id");
  const deal = dealId ? get<any>("SELECT * FROM deals WHERE id = ?", dealId) : null;
  const companyId = deal?.company_id ?? (await ensureCompany(S(fd, "company")));
  const descs = fd.getAll("item_desc").map((x) => String(x).trim());
  const qtys = fd.getAll("item_qty").map((x) => parseFloat(String(x)) || 1);
  const amts = fd.getAll("item_amount").map((x) => parseMoney(String(x)));
  const items = descs.map((d, i) => ({ d, q: qtys[i], a: amts[i] })).filter((x) => x.d && x.a !== null);
  if (!items.length) return { error: "Add at least one line item with an amount." };
  const cur = S(fd, "currency") ?? deal?.currency ?? "USD";
  const id = uid("inv");
  const issue = D(fd, "issue_date") ?? today();
  const terms = S(fd, "terms") ?? getSetting<any>("invoice", {}).defaultTerms ?? "Net 30";
  const days = parseInt((terms.match(/\d+/) ?? ["30"])[0], 10);
  const due = D(fd, "due_date") ?? addDays(issue, days);
  const number = S(fd, "number") ?? (await nextInvoiceNumber(+issue.slice(0, 4)));
  if (get("SELECT 1 FROM invoices WHERE number = ?", number)) return { error: `Invoice number ${number} already exists.` };
  const total = items.reduce((s, x) => s + Math.round(x.q * x.a!), 0);
  run(`INSERT INTO invoices (id, number, deal_id, company_id, billing_contact_id, issue_date, due_date, amount, currency, status, terms, description, notes, bill_to_name, bill_to_address, bill_to_email, source, number_source)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, number, dealId, companyId, S(fd, "contact_id") ?? deal?.contact_id ?? null, issue, due, total, cur, "Draft", terms, S(fd, "description"), S(fd, "notes") ?? getSetting<any>("invoice", {}).notes, S(fd, "bill_to_name"), S(fd, "bill_to_address"), S(fd, "bill_to_email"), "manual", "Nolan OS numbering");
  items.forEach((x, i) => run("INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_amount, position) VALUES (?,?,?,?,?,?)", uid("ii"), id, x.d, x.q, x.a, i));
  if (dealId) log("deal", dealId, "invoice", `Invoice ${number} drafted`);
  refresh();
  redirect(`/invoices/${id}`);
}

function syncInvoiceStatus(invoiceId: string) {
  const inv = get<any>("SELECT * FROM invoices WHERE id = ?", invoiceId);
  if (!inv || ["Void", "Written off"].includes(inv.status)) return;
  const paid = all<any>("SELECT amount FROM payments WHERE invoice_id = ? AND amount IS NOT NULL", invoiceId).reduce((s, p) => s + p.amount, 0);
  if (inv.amount !== null && paid >= inv.amount && inv.amount > 0) run("UPDATE invoices SET status = 'Paid' WHERE id = ?", invoiceId);
  else if (paid > 0) run("UPDATE invoices SET status = 'Partially paid' WHERE id = ?", invoiceId);
}

export async function invoiceAction(fd: FormData) {
  const id = S(fd, "id")!; const act = S(fd, "act")!;
  const inv = get<any>("SELECT * FROM invoices WHERE id = ?", id); if (!inv) return;
  const t = today();
  if (act === "sent") run("UPDATE invoices SET status = 'Sent', sent_at = ? WHERE id = ?", t, id);
  if (act === "viewed") run("UPDATE invoices SET status = 'Viewed', viewed_at = ? WHERE id = ?", t, id);
  if (act === "void") { if (fd.get("confirm") !== "yes") return; run("UPDATE invoices SET status = 'Void', voided_at = ? WHERE id = ?", t, id); }
  if (act === "disputed") run("UPDATE invoices SET status = 'Disputed', disputed = 1 WHERE id = ?", id);
  if (act === "writeoff") { if (fd.get("confirm") !== "yes") return; run("UPDATE invoices SET status = 'Written off', written_off = 1 WHERE id = ?", id); }
  if (act === "paid") {
    const paid = all<any>("SELECT amount FROM payments WHERE invoice_id = ? AND amount IS NOT NULL", id).reduce((s, p) => s + p.amount, 0);
    const rest = (inv.amount ?? 0) - paid;
    if (rest > 0) run("INSERT INTO payments (id, deal_id, invoice_id, date, amount, currency, method, verified, source, notes) VALUES (?,?,?,?,?,?,?,?,?,?)", uid("py"), inv.deal_id, id, D(fd, "date") ?? t, rest, inv.currency, S(fd, "method"), 1, "manual", "Marked paid by you");
    run("UPDATE invoices SET status = 'Paid' WHERE id = ?", id);
    if (inv.deal_id) { run("UPDATE deals SET manual_outstanding = NULL, payment_verification = 'manual' WHERE id = ?", inv.deal_id); recomputePayment(inv.deal_id); }
  }
  if (act === "duplicate") {
    const nid = uid("inv"); const number = await nextInvoiceNumber();
    run(`INSERT INTO invoices (id, number, deal_id, company_id, billing_contact_id, issue_date, due_date, amount, currency, status, terms, description, notes, bill_to_name, bill_to_address, bill_to_email, source, number_source)
         SELECT ?, ?, deal_id, company_id, billing_contact_id, ?, ?, amount, currency, 'Draft', terms, description, notes, bill_to_name, bill_to_address, bill_to_email, 'manual', 'Nolan OS numbering' FROM invoices WHERE id = ?`, nid, number, t, addDays(t, parseInt((inv.terms ?? "30").match(/\d+/)?.[0] ?? "30", 10)), id);
    run("INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_amount, position) SELECT ? || '_' || position, ?, description, quantity, unit_amount, position FROM invoice_items WHERE invoice_id = ?", nid, nid, id);
    refresh();
    redirect(`/invoices/${nid}`);
  }
  if (inv.deal_id) log("deal", inv.deal_id, "invoice", `Invoice ${inv.number ?? ""}: ${act}`);
  refresh();
}

// ---------------------------------------------------------------- email analysis and review queue
export async function analyzeEmail(_: ActionState, fd: FormData): Promise<ActionState> {
  const body = S(fd, "body"); if (!body) return { error: "Paste the email text first." };
  const from = S(fd, "from") ?? "unknown@unknown";
  const subject = S(fd, "subject") ?? "(no subject)";
  const claimed = S(fd, "company");
  const ignore = all<any>("SELECT value FROM ignore_rules WHERE kind IN ('domain','sender')").map((r) => r.value);
  const dom = (from.match(/<([^>]+)>/)?.[1] ?? from).split("@")[1]?.toLowerCase();
  if (dom && ignore.some((x) => x.toLowerCase() === dom || from.toLowerCase().includes(x.toLowerCase()))) return { error: "This sender or domain is on your ignore list, so it was not analysed. Change that in Settings." };
  const cls = classifyEmail({ from, subject, body });
  const sus = suspiciousSignals({ from, body, subject, claimedCompany: claimed });
  const deal = extractDeal(`${subject}\n${body}`);
  const promise = detectPaymentPromise(body);
  const cid = uid("cm");
  const reasons = sus.reasons;
  const klass = reasons.length >= 2 ? "Suspicious" : cls.klass;
  run(`INSERT INTO communications (id, thread_id, date, direction, sender, recipient, subject, snippet, body, company_name, classification, priority, extracted, extraction_status, suspicious_reasons, source)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, cid, uid("th"), D(fd, "date") ?? today(), "in", from, "nolanontherun@gmail.com", subject, body.slice(0, 300), body, claimed, klass, cls.priority, JSON.stringify({ facts: deal.facts, promise }), "AI extracted", reasons.length ? JSON.stringify(reasons) : null, "pasted");
  const isLead = ["New Lead", "Proposal"].includes(cls.klass) && klass !== "Suspicious";
  if (isLead) {
    const offer = deal.facts.find((f) => f.key === "offer");
    run("INSERT INTO review_queue (id, kind, source_communication_id, company_name, contact_name, contact_email, summary, potential_budget, budget_currency, budget_status, deliverables, confidence, received, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      uid("rq"), "potential_lead", cid, claimed, (from.match(/^"?([^"<]+?)"?\s*</)?.[1] ?? null), (from.match(/<([^>]+)>/)?.[1] ?? from), subject, offer?.amount ?? null, offer?.currency ?? null, offer ? (offer.certainty === "FACT" ? "stated, unconfirmed" : "hedged, unconfirmed") : null,
      JSON.stringify(deal.facts.filter((f) => f.key === "deliverable").map((f) => f.value)), cls.lead.confidence, D(fd, "date") ?? today(), "needs_review");
  }
  if (promise) run("INSERT INTO payment_promises (id, communication_id, date, claimed_date, text, contact, confidence, status, note) VALUES (?,?,?,?,?,?,?,?,?)", uid("pp"), cid, today(), promise.claimed, promise.text, from, "medium", "open", "A promise is not a payment. Link it to a deal and keep the invoice unpaid until you confirm.");
  refresh();
  redirect(`/inbox?tab=analyze&c=${cid}`);
}

export async function reviewAction(fd: FormData) {
  const id = S(fd, "id")!; const act = S(fd, "act")!;
  const r = get<any>("SELECT * FROM review_queue WHERE id = ?", id); if (!r) return;
  if (act === "ignore") run("UPDATE review_queue SET status = 'ignored' WHERE id = ?", id);
  if (act === "spam") { run("UPDATE review_queue SET status = 'spam' WHERE id = ?", id); run("UPDATE communications SET classification='Spam' WHERE id = ?", r.source_communication_id); }
  if (act === "suspicious") { run("UPDATE review_queue SET status = 'suspicious' WHERE id = ?", id); run("UPDATE communications SET classification='Suspicious' WHERE id = ?", r.source_communication_id); }
  if (act === "contact" || act === "company") {
    if (act === "company") await ensureCompany(r.company_name);
    else if (r.contact_name || r.contact_email) run("INSERT INTO contacts (id, full_name, email, company_id, contact_type, source, source_notes) VALUES (?,?,?,?,?,?,?)", uid("ct"), r.contact_name ?? r.contact_email, r.contact_email, await ensureCompany(r.company_name), "Brand", "email", "Created from the review queue.");
  }
  if (act === "followup") run("INSERT INTO tasks (id, title, due_date, kind, source) VALUES (?,?,?,?,?)", uid("tk"), `Reply to ${r.company_name ?? r.contact_name ?? "inquiry"}: ${r.summary ?? ""}`, addDays(today(), 1), "follow-up", "review");
  if (act === "convert") {
    const company = r.company_name ?? "Unknown company";
    const cid = await ensureCompany(company);
    const did = uid("dl");
    const dels: string[] = JSON.parse(r.deliverables ?? "[]");
    run("INSERT INTO deals (id, name, company_id, stage, status, currency, initial_offer, payment_state, date_received, source, source_notes, field_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", did, `${company}${r.summary ? " - " + r.summary.replace(/^Re:\s*/i, "") : ""}`.slice(0, 120), cid, "Lead", "open", r.budget_currency ?? "USD", r.potential_budget, "n/a", r.received ?? today(), "email", `Created from the review queue. Budget status: ${r.budget_status ?? "none stated"}. AI extracted, confirm before relying on it.`, JSON.stringify({ initial_offer: "ai_extracted" }));
    dels.forEach((v) => run("INSERT INTO deliverables (id, deal_id, content_type, status, notes) VALUES (?,?,?,?,?)", uid("dv"), did, v, "Planned", "AI extracted. Confirm quantity and platform."));
    run("UPDATE communications SET deal_id = ?, company_id = ? WHERE id = ?", did, cid, r.source_communication_id);
    run("UPDATE review_queue SET status = 'converted', converted_deal_id = ? WHERE id = ?", did, id);
    log("deal", did, "create", "Created from review queue (AI extracted values need confirmation)");
    refresh();
    redirect(`/deals/${did}`);
  }
  refresh();
}

export async function setCommClass(fd: FormData) {
  run("UPDATE communications SET classification = ?, priority = COALESCE(?, priority) WHERE id = ?", S(fd, "classification"), S(fd, "priority"), S(fd, "id")!);
  refresh();
}
export async function markCommHandled(fd: FormData) { run("UPDATE communications SET handled = 1 WHERE id = ?", S(fd, "id")!); refresh(); }
export async function confirmExtraction(fd: FormData) {
  run("UPDATE communications SET extraction_status = 'Confirmed' WHERE id = ?", S(fd, "id")!);
  refresh();
}

// ---------------------------------------------------------------- duplicates
export async function resolveDuplicate(fd: FormData) {
  const id = S(fd, "id")!; const act = S(fd, "act")!;
  const dup = get<any>("SELECT * FROM duplicate_reviews WHERE id = ?", id); if (!dup) return;
  if (act === "keep" || act === "ignore") { run("UPDATE duplicate_reviews SET status = ?, decided_at = datetime('now') WHERE id = ?", act === "keep" ? "kept_separate" : "ignored", id); refresh(); return; }
  if (act === "merge") {
    if (fd.get("confirm") !== "yes") return;
    const keep = S(fd, "keep") === "b" ? dup.b_id : dup.a_id; const lose = keep === dup.a_id ? dup.b_id : dup.a_id;
    const db = getDb();
    db.transaction(() => {
      if (dup.kind === "deal") {
        for (const t of ["deliverables", "negotiation_rounds", "usage_rights", "exclusivity", "payments", "invoices", "expenses", "communications", "documents", "tasks", "payment_promises"]) db.prepare(`UPDATE ${t} SET deal_id = ? WHERE deal_id = ?`).run(keep, lose);
        db.prepare("UPDATE deals SET archived = 1, stage = 'Archived', source_notes = COALESCE(source_notes,'') || ? WHERE id = ?").run(` | Merged into ${keep} after duplicate review.`, lose);
      } else {
        const isCo = lose.startsWith("co_"); const isAg = lose.startsWith("ag_");
        if (isCo) { for (const t of ["deals", "contacts", "campaigns", "communications", "documents", "tasks", "invoices"]) db.prepare(`UPDATE ${t} SET company_id = ? WHERE company_id = ?`).run(keep.startsWith("co_") ? keep : null, lose); db.prepare("UPDATE company_tags SET company_id = ? WHERE company_id = ? AND tag_id NOT IN (SELECT tag_id FROM company_tags WHERE company_id = ?)").run(keep, lose, keep); const lo = db.prepare("SELECT name FROM companies WHERE id=?").get(lose) as any; const k = db.prepare("SELECT original_source FROM companies WHERE id=?").get(keep) as any; const meta = JSON.parse(k?.original_source ?? "{}"); meta.aliases = [...(meta.aliases ?? []), lo?.name]; db.prepare("UPDATE companies SET original_source = ?, archived = 0 WHERE id = ?").run(JSON.stringify(meta), keep); db.prepare("UPDATE companies SET archived = 1, source_notes = COALESCE(source_notes,'') || ? WHERE id = ?").run(` | Merged into ${keep}`, lose); }
        else if (isAg) { for (const t of ["deals", "contacts", "campaigns"]) db.prepare(`UPDATE ${t} SET agency_id = ? WHERE agency_id = ?`).run(keep, lose); db.prepare("UPDATE agencies SET archived = 1, source_notes = COALESCE(source_notes,'') || ? WHERE id = ?").run(` | Merged into ${keep}`, lose); }
      }
      db.prepare("UPDATE duplicate_reviews SET status = 'merged', decided_at = datetime('now') WHERE id = ?").run(id);
    })();
    log(dup.kind, keep, "merge", `Merged ${lose} into ${keep}`);
    refresh();
  }
}

// ---------------------------------------------------------------- rate cards
export async function addRateCard(fd: FormData) {
  const year = N(fd, "year"); if (!year) return;
  run("INSERT INTO rate_cards (id, year, label, confirmed, source_notes) VALUES (?,?,?,?,?)", uid("rc"), year, S(fd, "label") ?? `${year} rates`, 1, "Entered manually");
  refresh();
}
export async function addRateItem(fd: FormData) {
  run("INSERT INTO rate_card_items (id, rate_card_id, platform, content_type, base_rate, currency, usage_rate, exclusivity_rate, whitelisting_rate, production_rate, travel_rate, rush_fee, note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", uid("ri"), S(fd, "rate_card_id")!, S(fd, "platform"), S(fd, "content_type"), M(fd, "base_rate"), S(fd, "currency") ?? "USD", S(fd, "usage_rate"), S(fd, "exclusivity_rate"), S(fd, "whitelisting_rate"), S(fd, "production_rate"), S(fd, "travel_rate"), S(fd, "rush_fee"), S(fd, "note"));
  refresh();
}
export async function confirmRateCard(fd: FormData) { run("UPDATE rate_cards SET confirmed = 1 WHERE id = ?", S(fd, "id")!); refresh(); }
export async function deleteRateItem(fd: FormData) { if (fd.get("confirm") !== "yes") return; run("DELETE FROM rate_card_items WHERE id = ?", S(fd, "id")!); refresh(); }

// ---------------------------------------------------------------- documents
export async function addDocument(fd: FormData) {
  const name = S(fd, "name"); if (!name) return;
  run("INSERT INTO documents (id, deal_id, company_id, name, kind, url, notes) VALUES (?,?,?,?,?,?,?)", uid("dc"), S(fd, "deal_id"), S(fd, "company_id"), name, S(fd, "kind"), S(fd, "url"), S(fd, "notes"));
  if (S(fd, "deal_id")) log("deal", S(fd, "deal_id")!, "document", `Added document ${name}`);
  refresh();
}

// ---------------------------------------------------------------- settings
export async function saveSettings(fd: FormData) {
  const kind = S(fd, "kind");
  if (kind === "profile") setSetting("profile", { name: S(fd, "name") ?? "", business: S(fd, "business") ?? "", email: S(fd, "email") ?? "", address: S(fd, "address") ?? "", website: S(fd, "website") ?? "" });
  if (kind === "invoice") { const cur = getSetting<any>("invoice", {}); setSetting("invoice", { ...cur, prefix: (S(fd, "prefix") ?? "NTR").toUpperCase(), defaultTerms: S(fd, "defaultTerms") ?? "Net 30", paymentInfo: S(fd, "paymentInfo") ?? "", notes: S(fd, "notes") ?? "" }); }
  if (kind === "behaviour") {
    const cur = getSetting<any>("behaviour", {});
    setSetting("behaviour", { ...cur, blockExclusivityConflicts: fd.get("blockExclusivityConflicts") === "on", dormantMonths: N(fd, "dormantMonths") ?? 6, replyDays: N(fd, "replyDays") ?? 2, chaseDays: N(fd, "chaseDays") ?? 5, contractDays: N(fd, "contractDays") ?? 3, usageWarnDays: N(fd, "usageWarnDays") ?? 30, exclusivityWarnDays: N(fd, "exclusivityWarnDays") ?? 30, highValueUSD: N(fd, "highValueUSD") ?? 5000 });
  }
  if (kind === "fx") {
    const fx: Record<string, number> = {};
    for (const c of ["EUR", "GBP", "CAD", "AUD", "JPY", "CHF"]) { const v = N(fd, `fx_${c}`); if (v && v > 0) fx[c] = v; }
    setSetting("fx", fx);
  }
  if (kind === "rules") {
    for (const r of all<any>("SELECT id, threshold FROM notification_rules")) {
      run("UPDATE notification_rules SET enabled = ?, threshold = COALESCE(?, threshold) WHERE id = ?", fd.get(`on_${r.id}`) === "on" ? 1 : 0, N(fd, `th_${r.id}`), r.id);
    }
  }
  refresh();
}
export async function addIgnoreRule(fd: FormData) { const v = S(fd, "value"); if (!v) return; run("INSERT INTO ignore_rules (id, kind, value, note) VALUES (?,?,?,?)", uid("ig"), S(fd, "kind") ?? "domain", v.toLowerCase(), S(fd, "note")); refresh(); }
export async function removeIgnoreRule(fd: FormData) { run("DELETE FROM ignore_rules WHERE id = ?", S(fd, "id")!); refresh(); }
