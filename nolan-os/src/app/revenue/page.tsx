import Link from "next/link";
import { all } from "@/lib/db";
import { dashboard, loadDeals } from "@/lib/queries";
import { PageHeader, Section, Stat, Tabs, Unknown, Empty } from "@/components/ui";
import { dateLabel, money, moneyMap, monthLabel, today } from "@/lib/format";
import { addMoney } from "@/lib/calc";
import { addExpense } from "@/lib/actions";
import { CURRENCIES, EXPENSE_CATEGORIES } from "@/lib/constants";
import { Columns } from "@/components/Charts";

export const metadata = { title: "Revenue" };
export default async function Revenue({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "overview" } = await searchParams;
  const dash = dashboard();
  const deals = loadDeals();
  const pays = all<any>("SELECT amount, currency, date FROM payments WHERE amount IS NOT NULL");
  const other = all<any>("SELECT * FROM revenue_other ORDER BY date DESC");
  const exps = all<any>("SELECT x.*, d.name dname FROM expenses x LEFT JOIN deals d ON d.id=x.deal_id ORDER BY x.date DESC");
  const byYear = new Map<string, Record<string, number>>();
  for (const p of pays) { const k = p.date?.slice(0, 4) ?? "Date not recorded"; const m = byYear.get(k) ?? {}; addMoney(m, p.currency, p.amount); byYear.set(k, m); }
  for (const d of deals) if (d.payment_state === "presumed_paid") { const k = d.year; const m = byYear.get(k + " (unconfirmed)") ?? {}; for (const [c, v] of Object.entries(d.fin.recognized)) addMoney(m, c, v); byYear.set(k + " (unconfirmed)", m); }
  const years = [...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const otherTot: Record<string, number> = {}; for (const o of other) addMoney(otherTot, o.currency, o.amount);
  const booked: Record<string, number> = {}; const pending: Record<string, number> = {};
  for (const d of deals) { if (["Agreed", "Contract sent", "Contract signed", "Production", "Content delivered", "Invoice sent"].includes(d.stage) && d.fin.gross !== null) addMoney(booked, d.currency, d.fin.gross); if (d.fin.outstanding?.amount) addMoney(pending, d.fin.outstanding.currency, d.fin.outstanding.amount); }
  const monthsUSD = new Map<string, number>(); for (const p of pays) if (p.date && p.currency === "USD") monthsUSD.set(p.date.slice(0, 7), (monthsUSD.get(p.date.slice(0, 7)) ?? 0) + p.amount);
  const series = [...monthsUSD.entries()].sort().map(([key, value]) => ({ key, value }));
  const tabs = [{ id: "overview", label: "Overview" }, { id: "other", label: "Other income", count: other.length }, { id: "expenses", label: "Expenses", count: exps.length }];
  return (
    <div>
      <PageHeader title="Revenue" kicker="Money in, money owed" sub="Received means a payment is on record. Booked is agreed work not yet paid. Different currencies are shown side by side, never merged." />
      <Tabs tabs={tabs} active={tab} base="/revenue" />
      {tab === "overview" && (<>
        <div className="mb-10 grid grid-cols-2 gap-x-8 gap-y-7 lg:grid-cols-4">
          <Stat big label="Lifetime received" value={moneyMap(dash.rev.lifetime, { compact: true })} sub={Object.keys(dash.rev.unverified).length ? `includes ${moneyMap(dash.rev.unverified)} counted without proof` : undefined} />
          <Stat label="This year" value={moneyMap(dash.rev.year)} /><Stat label="This quarter" value={moneyMap(dash.rev.quarter)} /><Stat label="This month" value={moneyMap(dash.rev.month)} />
          <Stat label="Outstanding" value={moneyMap(pending)} tone={Object.keys(pending).length ? "warn" : undefined} sub={dash.unknownOutstanding ? `plus ${dash.unknownOutstanding} unpaid with no amount` : undefined} />
          <Stat label="Booked, in progress" value={moneyMap(booked)} sub="agreed, not yet delivered or paid" /><Stat label="Pipeline" value={moneyMap(dash.negotiating)} sub="best known value of open leads" /><Stat label="Other income" value={moneyMap(otherTot)} sub="store sales and payouts" />
        </div>
        <Section title="Received by month" aside="USD payments with a date"><Columns data={series} label={(k) => monthLabel(k).replace(" 20", " ’")} height={150} /></Section>
        <Section title="By year">
          <table className="tbl"><thead><tr><th>Year</th><th className="text-right">Received</th></tr></thead><tbody>{years.map(([y, m]) => <tr key={y}><td>{y}{y.includes("unconfirmed") && <span className="ml-2 text-[11.5px] text-warn">deals marked done, no proof of payment</span>}</td><td className="num">{moneyMap(m)}</td></tr>)}</tbody></table>
          <p className="mt-3 text-[12px] text-faint">Deals with a recorded amount but no payment date appear under "Date not recorded". Add the date on the deal and it moves into the right year.</p>
        </Section>
      </>)}
      {tab === "other" && (other.length ? <table className="tbl"><thead><tr><th>Date</th><th>Source</th><th>Type</th><th className="text-right">Amount</th></tr></thead><tbody>{other.map((o) => <tr key={o.id}><td>{dateLabel(o.date, { year: true })}</td><td>{o.source}<div className="text-[11.5px] text-faint">{o.description}</div></td><td className="text-mute">{o.type}</td><td className="num">{money(o.amount, o.currency, { cents: true })}</td></tr>)}</tbody></table> : <Empty title="No other income recorded">Store sales, affiliate and platform payouts appear here.</Empty>)}
      {tab === "expenses" && (<>
        {exps.length ? <table className="tbl"><thead><tr><th>Date</th><th>Category</th><th>Deal</th><th className="text-right">Amount</th></tr></thead><tbody>{exps.map((e) => <tr key={e.id}><td>{dateLabel(e.date, { year: true })}</td><td>{e.category}<div className="text-[11.5px] text-faint">{e.description}</div></td><td>{e.deal_id ? <Link href={`/deals/${e.deal_id}`} className="hover:text-accent">{e.dname}</Link> : <Unknown text="General" />}</td><td className="num">{money(e.amount, e.currency, { cents: true })}</td></tr>)}</tbody></table> : <Empty title="No expenses recorded">Historical deals have no cost data, so profit is not estimated for them. Add expenses to a deal to see its margin.</Empty>}
        <form action={addExpense} className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3"><label className="sm:col-span-3"><span className="label">Deal (optional)</span><select name="deal_id" className="input"><option value="">General business expense</option>{deals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label><span className="label">Category</span><select name="category" className="input">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label><label><span className="label">Amount</span><input name="amount" required className="input" inputMode="decimal" /></label><label><span className="label">Currency</span><select name="currency" className="input">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label><label><span className="label">Date</span><input type="date" name="date" defaultValue={today()} className="input" /></label><label className="sm:col-span-2"><span className="label">Description</span><input name="description" className="input" /></label><div><button className="btn btn-primary">Add expense</button></div></form>
      </>)}
    </div>
  );
}
