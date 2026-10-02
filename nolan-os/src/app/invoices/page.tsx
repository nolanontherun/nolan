import Link from "next/link";
import { all } from "@/lib/db";
import { loadDeals } from "@/lib/queries";
import { invoiceStatusLabel } from "@/lib/calc";
import { PageHeader, Badge, Section, Empty, Unknown } from "@/components/ui";
import { dateLabel, daysFromToday, money, moneyMap, relDays, today } from "@/lib/format";

export const metadata = { title: "Invoices" };
const TONE: Record<string, "good" | "warn" | "bad" | "mute"> = { Paid: "good", Overdue: "bad", "Due today": "bad", "Due soon": "warn", "Partially paid": "warn", Disputed: "bad", Draft: "mute", Void: "mute", "Written off": "mute", Sent: "mute", Viewed: "mute" };

export default async function Invoices({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const t = today();
  const invs = all<any>("SELECT i.*, c.name company_name, d.name deal_name, (SELECT COALESCE(SUM(amount),0) FROM payments p WHERE p.invoice_id = i.id) paid FROM invoices i LEFT JOIN companies c ON c.id=i.company_id LEFT JOIN deals d ON d.id=i.deal_id ORDER BY COALESCE(i.issue_date,'0000') DESC").map((i) => ({ ...i, label: invoiceStatusLabel(i, i.paid, t) }));
  const unpaidWork = loadDeals().filter((d) => d.fin.outstanding && !invs.some((i) => i.deal_id === d.id && !["Void", "Paid"].includes(i.status)));
  const rows = s ? invs.filter((i) => i.label === s) : invs;
  const open = invs.filter((i) => !["Paid", "Void", "Written off", "Draft"].includes(i.label));
  const out: Record<string, number> = {}; const over: Record<string, number> = {};
  for (const i of open) if (i.amount !== null) { const bal = i.amount - i.paid; out[i.currency] = (out[i.currency] ?? 0) + bal; if (i.label === "Overdue") over[i.currency] = (over[i.currency] ?? 0) + bal; }
  const statuses = [...new Set(invs.map((i) => i.label))];
  return (
    <div>
      <PageHeader title="Invoices" kicker={`${invs.length} on record`} sub="Invoices from your Nolan OS numbering and the PayPal invoices found in Gmail. Only you or a verified payment can mark one paid.">
        <a href="/api/export/invoices" className="btn btn-sm">Export CSV</a><Link href="/invoices/new" className="btn btn-primary">New invoice</Link>
      </PageHeader>
      <div className="mb-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div><div className="caps">Open invoices</div><div className="mt-1 text-[22px] font-medium tabular-nums">{moneyMap(out)}</div><div className="text-[12px] text-mute">{open.length} awaiting payment</div></div>
        <div><div className="caps">Overdue</div><div className={`mt-1 text-[22px] font-medium tabular-nums ${Object.keys(over).length ? "text-bad" : ""}`}>{moneyMap(over)}</div><div className="text-[12px] text-mute">{invs.filter((i) => i.label === "Overdue").length} invoices</div></div>
        <div><div className="caps">Unpaid work, no invoice</div><div className="mt-1 text-[22px] font-medium tabular-nums">{unpaidWork.length}</div><div className="text-[12px] text-mute">deals to invoice</div></div>
      </div>
      {unpaidWork.length > 0 && !s && (
        <Section title="Unpaid work without an invoice">
          <table className="tbl"><tbody>{unpaidWork.map((d) => <tr key={d.id}><td><Link href={`/deals/${d.id}`} className="font-medium hover:text-accent">{d.name}</Link><div className="text-[12px] text-mute">{d.stage}{d.days_outstanding !== null ? ` · ${d.days_outstanding} days since posting` : " · no posting or invoice date recorded"}</div></td><td className="num">{d.fin.outstanding?.amount === null ? <Unknown /> : money(d.fin.outstanding!.amount, d.fin.outstanding!.currency)}</td><td className="text-right"><Link href={`/invoices/new?deal=${d.id}`} className="btn btn-sm">Create invoice</Link></td></tr>)}</tbody></table>
        </Section>
      )}
      <div className="mb-4 flex flex-wrap gap-1.5"><Link href="/invoices" className={`chip ${!s ? "chip-on" : ""}`}>All</Link>{statuses.map((x) => <Link key={x} href={`/invoices?s=${encodeURIComponent(x)}`} className={`chip ${s === x ? "chip-on" : ""}`}>{x}</Link>)}</div>
      {rows.length ? (
        <table className="tbl"><thead><tr><th>Invoice</th><th>Client</th><th>Issued</th><th>Due</th><th>Status</th><th className="text-right">Amount</th><th className="text-right">Balance</th></tr></thead><tbody>
          {rows.map((i) => <tr key={i.id}><td><Link href={`/invoices/${i.id}`} className="font-medium hover:text-accent">{i.number ?? <Unknown text="Number not recorded" />}</Link>{i.source === "gmail" && <div className="text-[11px] text-faint">from Gmail</div>}</td><td className="text-mute">{i.company_name ?? "—"}</td><td className="text-mute">{i.issue_date ? dateLabel(i.issue_date, { year: true }) : "—"}</td><td className="text-mute">{i.due_date ? `${dateLabel(i.due_date, { year: true })} · ${relDays(daysFromToday(i.due_date))}` : "—"}</td><td><Badge tone={TONE[i.label]}>{i.label}</Badge></td><td className="num">{i.amount === null ? <Unknown /> : money(i.amount, i.currency, { cents: true })}</td><td className="num">{i.amount === null ? "—" : money(Math.max(0, i.amount - i.paid), i.currency, { cents: true })}</td></tr>)}
        </tbody></table>
      ) : <Empty title="No invoices" action={<Link href="/invoices/new" className="btn btn-primary">Create the first one</Link>}>Invoices you create here get numbers like NTR-{new Date().getFullYear()}-001.</Empty>}
    </div>
  );
}
