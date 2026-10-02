// Relational schema. Money is stored as integer minor units (cents) plus an explicit currency.
// Nothing is converted silently. Unknown stays NULL; the UI renders NULL as "Not recorded".
export const SCHEMA_VERSION = 1;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, business_name TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, parent_company_id TEXT REFERENCES companies(id),
  industry TEXT, category TEXT, company_type TEXT, website TEXT, country TEXT, city TEXT, headquarters TEXT,
  size_range TEXT, size_source TEXT, size_source_date TEXT, is_public INTEGER, description TEXT,
  instagram TEXT, tiktok TEXT, youtube TEXT, linkedin TEXT, relationship_status TEXT,
  notes TEXT, source TEXT, source_notes TEXT, original_source TEXT, archived INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS agencies (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, website TEXT, location TEXT, employees_range TEXT, specialty TEXT,
  notes TEXT, source TEXT, source_notes TEXT, archived INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY, full_name TEXT NOT NULL, first_name TEXT, last_name TEXT, job_title TEXT,
  company_id TEXT REFERENCES companies(id), agency_id TEXT REFERENCES agencies(id),
  email TEXT, phone TEXT, linkedin TEXT, instagram TEXT, location TEXT, country TEXT, department TEXT,
  contact_type TEXT, relationship_status TEXT, preferred_communication TEXT, first_contact TEXT, last_contact TEXT,
  notes TEXT, source TEXT, source_notes TEXT, ignored INTEGER DEFAULT 0, archived INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY, company_id TEXT REFERENCES companies(id), agency_id TEXT REFERENCES agencies(id),
  name TEXT NOT NULL, year INTEGER, description TEXT, source TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  company_id TEXT REFERENCES companies(id), agency_id TEXT REFERENCES agencies(id),
  contact_id TEXT REFERENCES contacts(id), campaign_id TEXT REFERENCES campaigns(id),
  stage TEXT NOT NULL DEFAULT 'Lead', status TEXT DEFAULT 'open',
  deal_source TEXT, deal_type TEXT, client_type TEXT, category TEXT,
  date_received TEXT, date_contacted TEXT, date_negotiated TEXT, date_agreed TEXT, contract_date TEXT,
  campaign_date TEXT, posting_date TEXT, completion_date TEXT, invoice_date TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  initial_offer INTEGER, counter_offer INTEGER, final_amount INTEGER, product_value INTEGER,
  production_budget INTEGER, travel_budget INTEGER, crew_budget INTEGER, talent_budget INTEGER,
  usage_fee INTEGER, exclusivity_fee INTEGER, whitelisting_fee INTEGER, licensing_fee INTEGER, affiliate_commission INTEGER,
  payment_terms TEXT,
  payment_state TEXT DEFAULT 'unpaid',          -- paid | partial | unpaid | presumed_paid | n/a
  payment_verification TEXT,                    -- receipt | receipt-inferred | board | presumed | manual
  manual_outstanding INTEGER, manual_outstanding_currency TEXT, manual_outstanding_note TEXT,
  next_action TEXT, next_followup TEXT, reminder TEXT,
  source TEXT, source_notes TEXT, original_source TEXT, field_status TEXT,
  archived INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_deals_company ON deals(company_id);
CREATE INDEX IF NOT EXISTS ix_deals_stage ON deals(stage);
CREATE TABLE IF NOT EXISTS negotiation_rounds (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE, seq INTEGER,
  party TEXT, kind TEXT, amount INTEGER, currency TEXT, date TEXT, confirmed INTEGER DEFAULT 0, note TEXT
);
CREATE TABLE IF NOT EXISTS deliverables (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  platform TEXT, content_type TEXT, quantity REAL, deadline TEXT, published_date TEXT, status TEXT DEFAULT 'Planned', url TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY, number TEXT, deal_id TEXT REFERENCES deals(id), company_id TEXT REFERENCES companies(id),
  billing_contact_id TEXT REFERENCES contacts(id), issue_date TEXT, due_date TEXT, amount INTEGER, currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'Draft', terms TEXT, description TEXT, notes TEXT, bill_to_name TEXT, bill_to_address TEXT, bill_to_email TEXT,
  viewed_at TEXT, sent_at TEXT, voided_at TEXT, disputed INTEGER DEFAULT 0, written_off INTEGER DEFAULT 0,
  source TEXT, source_notes TEXT, number_source TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL, quantity REAL DEFAULT 1, unit_amount INTEGER NOT NULL, position INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, deal_id TEXT REFERENCES deals(id), invoice_id TEXT REFERENCES invoices(id),
  date TEXT, amount INTEGER, currency TEXT DEFAULT 'USD', method TEXT, reference TEXT, payer TEXT,
  verified INTEGER DEFAULT 0, notes TEXT, source TEXT, source_notes TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY, deal_id TEXT REFERENCES deals(id), date TEXT, category TEXT, description TEXT,
  amount INTEGER, currency TEXT DEFAULT 'USD', vendor TEXT, notes TEXT, source TEXT
);
CREATE TABLE IF NOT EXISTS usage_rights (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, start_date TEXT, end_date TEXT, territory TEXT, platforms TEXT, duration TEXT, fee INTEGER, currency TEXT, notes TEXT,
  status TEXT DEFAULT 'active', source TEXT
);
CREATE TABLE IF NOT EXISTS exclusivity (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  competitor_category TEXT, competitors TEXT, start_date TEXT, end_date TEXT, duration TEXT, fee INTEGER, currency TEXT, notes TEXT, source TEXT
);
CREATE TABLE IF NOT EXISTS communications (
  id TEXT PRIMARY KEY, thread_id TEXT, date TEXT, direction TEXT, sender TEXT, recipient TEXT, subject TEXT, snippet TEXT, body TEXT,
  company_id TEXT REFERENCES companies(id), contact_id TEXT REFERENCES contacts(id), deal_id TEXT REFERENCES deals(id), company_name TEXT,
  classification TEXT, priority TEXT, attachments TEXT, extracted TEXT, extraction_status TEXT DEFAULT 'AI extracted', handled INTEGER DEFAULT 0,
  suspicious_reasons TEXT, source TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_comm_thread ON communications(thread_id);
CREATE TABLE IF NOT EXISTS payment_promises (
  id TEXT PRIMARY KEY, communication_id TEXT REFERENCES communications(id), deal_id TEXT REFERENCES deals(id), invoice_id TEXT REFERENCES invoices(id),
  date TEXT, claimed_date TEXT, text TEXT, contact TEXT, confidence TEXT, status TEXT DEFAULT 'open', note TEXT
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, deal_id TEXT REFERENCES deals(id), company_id TEXT REFERENCES companies(id), name TEXT NOT NULL, kind TEXT, url TEXT,
  file_path TEXT, mime TEXT, size INTEGER, notes TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, deal_id TEXT REFERENCES deals(id), company_id TEXT REFERENCES companies(id), contact_id TEXT REFERENCES contacts(id),
  title TEXT NOT NULL, due_date TEXT, status TEXT DEFAULT 'open', kind TEXT DEFAULT 'task', priority TEXT DEFAULT 'medium', snoozed_until TEXT,
  notes TEXT, source TEXT, source_notes TEXT, created_at TEXT DEFAULT (datetime('now')), completed_at TEXT
);
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY, entity TEXT NOT NULL, entity_id TEXT NOT NULL, body TEXT NOT NULL, source TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS deal_tags (deal_id TEXT REFERENCES deals(id) ON DELETE CASCADE, tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (deal_id, tag_id));
CREATE TABLE IF NOT EXISTS company_tags (company_id TEXT REFERENCES companies(id) ON DELETE CASCADE, tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (company_id, tag_id));
CREATE TABLE IF NOT EXISTS contact_tags (contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE, tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (contact_id, tag_id));
CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY, entity TEXT, entity_id TEXT, at TEXT, kind TEXT, summary TEXT, detail TEXT
);
CREATE INDEX IF NOT EXISTS ix_activity_entity ON activity_log(entity, entity_id);
CREATE TABLE IF NOT EXISTS rate_cards (id TEXT PRIMARY KEY, year INTEGER, label TEXT, confirmed INTEGER DEFAULT 0, source_notes TEXT, terms TEXT);
CREATE TABLE IF NOT EXISTS rate_card_items (
  id TEXT PRIMARY KEY, rate_card_id TEXT NOT NULL REFERENCES rate_cards(id) ON DELETE CASCADE, platform TEXT, content_type TEXT, base_rate INTEGER, currency TEXT DEFAULT 'USD',
  usage_rate TEXT, exclusivity_rate TEXT, whitelisting_rate TEXT, production_rate TEXT, travel_rate TEXT, rush_fee TEXT, note TEXT
);
CREATE TABLE IF NOT EXISTS revenue_other (
  id TEXT PRIMARY KEY, date TEXT, source TEXT, type TEXT, description TEXT, amount INTEGER, currency TEXT, origin TEXT, source_notes TEXT
);
CREATE TABLE IF NOT EXISTS attention_state (
  key TEXT PRIMARY KEY, state TEXT NOT NULL, until TEXT, updated_at TEXT DEFAULT (datetime('now'))   -- handled | ignored | snoozed
);
CREATE TABLE IF NOT EXISTS review_queue (
  id TEXT PRIMARY KEY, kind TEXT, source_communication_id TEXT REFERENCES communications(id), company_name TEXT, contact_name TEXT, contact_email TEXT,
  summary TEXT, potential_budget INTEGER, budget_currency TEXT, budget_status TEXT, deliverables TEXT, confidence TEXT, received TEXT,
  status TEXT DEFAULT 'needs_review', converted_deal_id TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS duplicate_reviews (
  id TEXT PRIMARY KEY, kind TEXT, a_id TEXT, b_id TEXT, a_name TEXT, b_name TEXT, reason TEXT, status TEXT DEFAULT 'open', decided_at TEXT
);
CREATE TABLE IF NOT EXISTS ignore_rules (id TEXT PRIMARY KEY, kind TEXT, value TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS notification_rules (id TEXT PRIMARY KEY, event TEXT, enabled INTEGER DEFAULT 1, threshold INTEGER, label TEXT);
CREATE TABLE IF NOT EXISTS import_log (id TEXT PRIMARY KEY, at TEXT, kind TEXT, summary TEXT, detail TEXT);
`;
