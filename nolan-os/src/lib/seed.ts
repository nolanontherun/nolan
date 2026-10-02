import { getDb, setSetting, uid } from "./db";
import { DEFAULT_TAGS } from "./constants";

type Seed = Record<string, any[]> & { generated_at?: string };
const j = (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(v));

export function applyDefaults() {
  const db = getDb();
  const has = db.prepare("SELECT value FROM settings WHERE key='profile'").get();
  if (!has) {
    setSetting("profile", { name: "Nolan Guillou", business: "Nolan On The Run", email: "nolanontherun@gmail.com", address: "", website: "" });
    setSetting("invoice", { prefix: "NTR", defaultTerms: "Net 30", paymentInfo: "", notes: "Thank you for the collaboration.", nextSeq: {} });
    setSetting("behaviour", { blockExclusivityConflicts: false, dormantMonths: 6, replyDays: 2, chaseDays: 5, contractDays: 3, usageWarnDays: 30, exclusivityWarnDays: 30, highValueUSD: 5000 });
    setSetting("fx", {}); // e.g. {"EUR": 1.08}. Empty means nothing is converted.
    const ins = db.prepare("INSERT OR IGNORE INTO notification_rules (id, event, enabled, threshold, label) VALUES (?,?,?,?,?)");
    const rules: [string, string, number, number | null, string][] = [
      ["new_lead", "new_lead", 1, null, "New lead detected"], ["deal_over", "deal_over", 1, 5000, "Deal over $5,000 detected"], ["invoice_overdue", "invoice_overdue", 1, null, "Invoice becomes overdue"],
      ["invoice_due", "invoice_due", 1, 7, "Invoice due within N days"], ["followup_overdue", "followup_overdue", 1, null, "Follow-up overdue"], ["contract_unsigned", "contract_unsigned", 1, 3, "Contract unsigned for N days"],
      ["usage_expiring", "usage_expiring", 1, 30, "Usage expires within N days"], ["exclusivity_expiring", "exclusivity_expiring", 1, 30, "Exclusivity expires within N days"],
      ["suspicious", "suspicious", 1, null, "Possible scam detected"], ["high_priority_email", "high_priority_email", 1, null, "High-priority business email detected"],
    ];
    for (const r of rules) ins.run(...r);
  }
  const t = db.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)");
  for (const n of DEFAULT_TAGS) t.run("tg_" + n.toLowerCase().replace(/[^a-z0-9]+/g, "-"), n);
  const u = db.prepare("SELECT id FROM users LIMIT 1").get();
  if (!u) db.prepare("INSERT INTO users (id, name, email, business_name) VALUES (?,?,?,?)").run("usr_nolan", "Nolan Guillou", "nolanontherun@gmail.com", "Nolan On The Run");
}

export function loadSeed(seed: Seed) {
  const db = getDb();
  applyDefaults();
  const tx = db.transaction(() => {
    const ins = (table: string, row: Record<string, unknown>) => {
      const cols = Object.keys(row);
      db.prepare(`INSERT OR IGNORE INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(...cols.map((c) => row[c] as any));
    };
    for (const t of seed.tags ?? []) ins("tags", { id: t.id, name: t.name });
    const tagId = (name: string) => (db.prepare("SELECT id FROM tags WHERE name=?").get(name) as any)?.id ?? (() => { const id = "tg_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-"); ins("tags", { id, name }); return id; })();
    for (const c of seed.companies ?? []) {
      ins("companies", { id: c.id, name: c.name, company_type: c.company_type ?? null, category: c.category ?? null, source: c.source, source_notes: c.source_notes ?? null, original_source: j({ aliases: c.aliases ?? [] }) });
      for (const t of c.tags ?? []) ins("company_tags", { company_id: c.id, tag_id: tagId(t) });
    }
    for (const a of seed.agencies ?? []) ins("agencies", { id: a.id, name: a.name, source: a.source, source_notes: a.source_notes ?? null });
    for (const c of seed.contacts ?? []) ins("contacts", { id: c.id, full_name: c.full_name, first_name: c.first_name ?? null, last_name: c.last_name ?? null, job_title: c.job_title ?? null, company_id: c.company_id ?? null, agency_id: c.agency_id ?? null, email: c.email ?? null, contact_type: c.contact_type ?? null, source: c.source, source_notes: c.source_notes ?? null });
    for (const c of seed.campaigns ?? []) ins("campaigns", { id: c.id, company_id: c.company_id ?? null, name: c.name, year: c.year ?? null, source: c.source });
    for (const d of seed.deals ?? []) {
      ins("deals", {
        id: d.id, name: d.name, company_id: d.company_id, agency_id: d.agency_id ?? null, contact_id: d.contact_id ?? null, campaign_id: d.campaign_id ?? null, stage: d.stage, status: d.status,
        deal_source: d.deal_source ?? null, deal_type: d.deal_type ?? null, client_type: d.client_type ?? null, category: d.category ?? null, date_agreed: d.date_agreed ?? null, posting_date: d.posting_date ?? null,
        invoice_date: d.invoice_date ?? null, currency: d.currency, initial_offer: d.initial_offer ?? null, counter_offer: d.counter_offer ?? null, final_amount: d.final_amount ?? null, product_value: d.product_value ?? null,
        payment_terms: d.payment_terms ?? null, payment_state: d.payment_state, payment_verification: d.payment_verification ?? null, manual_outstanding: d.manual_outstanding ?? null,
        manual_outstanding_currency: d.manual_outstanding_currency ?? null, manual_outstanding_note: d.manual_outstanding_note ?? null, next_action: d.next_action ?? null, source: d.source,
        source_notes: d.source_notes ?? null, original_source: j(d.original_source), field_status: j(d.field_status),
      });
      for (const t of d.tags ?? []) ins("deal_tags", { deal_id: d.id, tag_id: tagId(t) });
    }
    for (const x of seed.deliverables ?? []) ins("deliverables", x);
    for (const x of seed.negotiation ?? []) ins("negotiation_rounds", x);
    for (const x of seed.invoices ?? []) ins("invoices", { id: x.id, number: x.number ?? null, deal_id: x.deal_id ?? null, company_id: x.company_id ?? null, issue_date: x.issue_date ?? null, due_date: x.due_date ?? null, amount: x.amount ?? null, currency: x.currency, status: x.status, terms: x.terms ?? null, description: x.description ?? null, source: x.source, source_notes: x.source_notes ?? null, number_source: x.number_source ?? null });
    for (const x of seed.payments ?? []) ins("payments", { id: x.id, deal_id: x.deal_id, invoice_id: x.invoice_id ?? null, date: x.date ?? null, amount: x.amount ?? null, currency: x.currency, method: x.method ?? null, reference: x.reference ?? null, payer: x.payer ?? null, verified: x.verified ?? 0, source: x.source, source_notes: x.source_notes ?? null });
    for (const x of seed.communications ?? []) ins("communications", { id: x.id, thread_id: x.thread_id ?? null, date: x.date ?? null, direction: x.direction, sender: x.sender, recipient: x.recipient, subject: x.subject, snippet: x.snippet, deal_id: x.deal_id ?? null, company_name: x.company_name ?? null, classification: x.classification, priority: x.priority, extracted: x.extracted ?? null, extraction_status: "Imported from source", source: x.source });
    for (const x of seed.payment_promises ?? []) ins("payment_promises", x);
    for (const x of seed.tasks ?? []) ins("tasks", { id: x.id, deal_id: x.deal_id ?? null, title: x.title, due_date: x.due_date ?? null, status: x.status, kind: x.kind, priority: x.priority, source: x.source, source_notes: x.source_notes ?? null });
    for (const x of seed.revenue_other ?? []) ins("revenue_other", x);
    for (const x of seed.activity ?? []) ins("activity_log", x);
    for (const x of seed.duplicates ?? []) ins("duplicate_reviews", { id: x.id, kind: x.kind, a_id: x.a_id, b_id: x.b_id, a_name: x.a_name, b_name: x.b_name, reason: x.reason, status: x.status });
    for (const rc of seed.rate_cards ?? []) {
      ins("rate_cards", { id: rc.id, year: rc.year, label: rc.label, confirmed: rc.confirmed, source_notes: rc.source_notes, terms: j(rc.terms) });
      for (const [i, it] of (rc.items ?? []).entries()) ins("rate_card_items", { id: `${rc.id}_${i}`, rate_card_id: rc.id, platform: it.platform, content_type: it.content_type, base_rate: it.base_rate, currency: it.currency, note: it.note });
    }
    for (const x of seed.usage_rights ?? []) ins("usage_rights", x);
    for (const x of seed.exclusivity ?? []) ins("exclusivity", x);
    for (const x of seed.expenses ?? []) ins("expenses", x);
    for (const x of seed.documents ?? []) ins("documents", x);
    for (const x of seed.notes ?? []) ins("notes", x);
    db.prepare("INSERT INTO import_log (id, at, kind, summary, detail) VALUES (?,?,?,?,?)").run(uid("im"), new Date().toISOString(), "seed", `Loaded seed generated ${seed.generated_at ?? "unknown"}`, JSON.stringify(Object.fromEntries(Object.entries(seed).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, (v as any[]).length]))));
  });
  tx();
}
