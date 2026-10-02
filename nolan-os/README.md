# Nolan OS

Private, local-first business operating system for a professional creator (Nolan On The Run).
Deals, companies, contacts, agencies, invoices, payments, usage rights, exclusivity, follow-ups,
email intelligence and analytics in one fast app that runs on your own machine.

- **Stack:** Next.js (App Router) · React · TypeScript · Tailwind · SQLite (`better-sqlite3`) · PDFKit · ExcelJS. No cloud service is needed.
- **Data:** one SQLite file at `data/nolan-os.db`. Money is stored as integer minor units with an explicit currency and is **never converted silently**.
- **Privacy:** `data/`, `data-private/` and `*.db` are git-ignored. This repository is public, so real business data must stay out of it.

## Run it

```bash
cd nolan-os
npm install
npm run setup     # creates data/nolan-os.db; loads data-private/seed.json when present
npm run dev       # http://localhost:3100   (npm run build && npm start for production)
npm test          # unit tests for the intelligence engine and finance maths
```

Open it on your phone from the same network (`http://<your-computer>:3100`) and use *Add to Home Screen*: it installs as a PWA.

## Importing your history

`data-private/build_seed.py` (kept out of git with the data it encodes) reconciles three private sources placed in `data-private/`:
`tracker.xlsx` (spreadsheet), `figma_board.json` (board stickies) and `gmail_facts.json` (payment receipts, invoices, contacts).
It writes `seed.json` and `migration_report.json` there. Nothing is dropped: ambiguous matches are kept as separate records and
flagged, unknown fields stay empty ("Not recorded"), and every record keeps its original source text.

```bash
python3 data-private/build_seed.py && npm run setup
```

After setup you can also import CSV, Excel or JSON from **Import and export**, and take a full JSON or SQLite backup there.

## Design rules the code enforces

- Nothing extracted by the email engine becomes a confirmed deal, amount or payment without you confirming it. Findings are labelled `FACT`, `INFERENCE` or unknown.
- A payment promise is not a payment. An invoice is only paid when you record or confirm a payment.
- Duplicate candidates are reviewed (merge, keep separate, ignore). Merges archive, never delete.
- Exclusivity conflicts warn; they only block if you turn that on in Settings.
- Dormant relationships are reported as facts ("no business activity recorded for 11 months"), never as advice or labels.

## Layout

```
src/lib/schema.ts       relational schema (companies, agencies, contacts, deals, deliverables, invoices, payments, usage_rights, exclusivity, communications, tasks, ...)
src/lib/calc.ts         pure finance helpers (gross, outstanding, profitability)
src/lib/intel.ts        rule-based email classification, extraction, scam signals, follow-up detection
src/lib/attention.ts    the Attention centre, upcoming items, daily and weekly briefs, exclusivity conflicts
src/lib/search.ts       global and natural-language search
src/lib/actions.ts      server actions (all mutations, with activity logging)
src/lib/invoice.ts      invoice numbering and PDF
src/lib/exportimport.ts CSV, Excel, JSON export, backup, restore, import
```
