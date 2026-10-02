import Link from "next/link";
import { all } from "@/lib/db";
import { PageHeader, Badge, Unknown, Empty } from "@/components/ui";
import { dateLabel, money, moneyMap } from "@/lib/format";
import { addPayment } from "@/lib/actions";
import { loadDeals } from "@/lib/queries";
import { CURRENCIES, PAYMENT_METHODS } from "@/lib/constants";
import { addMoney } from "@/lib/calc";

export const metadata = { title: "Payments" };
export default async function Payments({ searchParams }: { searchParams: Promise<{ f?: string; y?: string }> }) {
  const { f, y } = await searchParams;
  let rows = all<any>("SELECT p.*, d.name deal_name, i.number invoice_number FROM payments p LEFT JOIN deals d ON d.id=p.deal_id LEFT JOIN invoices i ON i.id=p.invoice_id ORDER BY COALESCE(p.date,'0000') DESC");
  if (f === "unverified") rows = rows.filter((p) => !p.verified);
  if (f === "nodate") rows = rows.filter((p) => !p.date);
  if (f === "noamount") rows = rows.filter((p) => p.amount === null);
  if (y) rows = rows.filter((p) => p.date?.startsWith(y));
  const years = [...new Set(all<any>("SELECT DISTINCT substr(date,1,4) y FROM payments WHERE date IS NOT NULL ORDER BY y DESC").map((r) => r.y))];
  const tot: Record<string, number> = {}; for (const p of rows) addMoney(tot, p.currency, p.amount);
  const deals = loadDeals();
  const chip = (on: boolean) => `chip ${on ? "chip-on" : ""}`;
  return (
    <div>
      <PageHeader title="Payments" kicker={`${rows.length} recorded`} sub="Money received, in the currency it arrived. A payment is only real once it is here; a promise in an email is not a payment." />
      <div className="mb-4 flex flex-wrap gap-1.5"><Link href="/payments" className={chip(!f && !y)}>All</Link><Link href="/payments?f=unverified" className={chip(f === "unverified")}>Unverified</Link><Link href="/payments?f=nodate" className={chip(f === "nodate")}>No date</Link><Link href="/payments?f=noamount" className={chip(f === "noamount")}>No amount</Link>{years.map((x) => <Link key={x} href={`/payments?y=${x}`} className={chip(y === x)}>{x}</Link>)}</div>
      <p className="mb-5 text-[13px] text-mute">Total in view: <b className="text-ink">{moneyMap(tot)}</b></p>
      {rows.length ? <table className="tbl"><thead><tr><th>Date</th><th>Deal</th><th>Method and reference</th><th>Status</th><th className="text-right">Amount</th></tr></thead><tbody>
        {rows.map((p) => <tr key={p.id}><td className="whitespace-nowrap">{p.date ? dateLabel(p.date, { year: true }) : <Unknown text="No date" />}</td><td>{p.deal_id ? <Link href={`/deals/${p.deal_id}`} className="font-medium hover:text-accent">{p.deal_name}</Link> : <Unknown text="Not linked to a deal" />}</td><td className="max-w-[320px] text-[12px] text-mute">{[p.method, p.reference, p.payer].filter(Boolean).join(" · ") || "Not recorded"}{p.source_notes && <div className="text-faint">{p.source_notes}</div>}</td><td>{p.verified ? <Badge tone="good">Verified</Badge> : <Badge tone="warn">Unverified</Badge>}</td><td className="num">{p.amount === null ? <Unknown /> : money(p.amount, p.currency, { cents: true })}</td></tr>)}
      </tbody></table> : <Empty title="No payments match" />}
      <details className="mt-10 no-print" open={false}><summary className="btn btn-sm cursor-pointer list-none">Record a payment</summary>
        <form action={addPayment} className="mt-3 grid max-w-3xl gap-3 sm:grid-cols-3">
          <label className="sm:col-span-3"><span className="label">Deal</span><select name="deal_id" required className="input"><option value="">Choose a deal</option>{deals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label><span className="label">Amount</span><input name="amount" required className="input" inputMode="decimal" /></label><label><span className="label">Currency</span><select name="currency" className="input">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label><label><span className="label">Date</span><input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" /></label>
          <label><span className="label">Method</span><select name="method" className="input"><option value="">Not recorded</option>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></label><label className="sm:col-span-2"><span className="label">Reference</span><input name="reference" className="input" /></label>
          <label className="flex items-center gap-2 text-[12.5px] text-mute sm:col-span-3"><input type="checkbox" name="settles" value="yes" /> This settles the deal in full</label>
          <div><button className="btn btn-primary">Record payment</button></div></form></details>
    </div>
  );
}
