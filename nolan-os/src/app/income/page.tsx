import Link from "next/link";
import { all } from "@/lib/db";
import { PageHeader, Section, Stat } from "@/components/ui";
import { Columns, Line, BarList } from "@/components/Charts";
import { money, monthLabel } from "@/lib/format";

export const metadata = { title: "Income" };
export default async function Income({ searchParams }: { searchParams: Promise<{ range?: string; by?: string }> }) {
  const { range = "all", by = "month" } = await searchParams;
  const pays = all<{ amount: number; currency: string; date: string; payer: string | null }>("SELECT p.amount, p.currency, p.date, COALESCE(p.payer, c.name, a.name) payer FROM payments p LEFT JOIN deals d ON d.id=p.deal_id LEFT JOIN companies c ON c.id=d.company_id LEFT JOIN agencies a ON a.id=d.agency_id WHERE p.amount IS NOT NULL AND p.date IS NOT NULL");
  const usd = pays.filter((p) => p.currency === "USD");
  const other = pays.filter((p) => p.currency !== "USD");
  const cut = range === "12" ? new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 7) : range === "6" ? new Date(Date.now() - 183 * 864e5).toISOString().slice(0, 7) : "0000";
  const keyOf = (d: string) => (by === "year" ? d.slice(0, 4) : by === "quarter" ? `${d.slice(0, 4)}-Q${Math.ceil(+d.slice(5, 7) / 3)}` : d.slice(0, 7));
  const rows = usd.filter((p) => p.date.slice(0, 7) >= cut);
  const sums = new Map<string, number>();
  for (const p of rows) sums.set(keyOf(p.date), (sums.get(keyOf(p.date)) ?? 0) + p.amount);
  const data = [...sums.entries()].sort().map(([key, value]) => ({ key, value }));
  let run = 0; const cum = data.map((d) => ({ key: d.key, value: (run += d.value) }));
  const total = rows.reduce((s, p) => s + p.amount, 0);
  const best = data.reduce((b, d) => (d.value > b.value ? d : b), { key: "-", value: 0 });
  const payers = new Map<string, number>();
  for (const p of rows) payers.set(p.payer ?? "Not recorded", (payers.get(p.payer ?? "Not recorded") ?? 0) + p.amount);
  const top = [...payers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([key, value]) => ({ key, value }));
  const link = (r: string, b: string) => `/income?range=${r}&by=${b}`;
  const pill = (on: boolean) => `rounded-full border px-3 py-1 text-[12.5px] ${on ? "border-ink bg-ink text-white" : "border-line/20 text-mute hover:text-ink"}`;
  return (
    <div>
      <PageHeader title="Income" kicker="How your money has grown" sub="Payments on record, USD. Other currencies are never converted." />
      <div className="mb-6 flex flex-wrap gap-2">
        {[["all", "All time"], ["12", "Last 12 months"], ["6", "Last 6 months"]].map(([r, l]) => <Link key={r} href={link(r, by)} className={pill(range === r)}>{l}</Link>)}
        <span className="w-3" />
        {[["month", "Month"], ["quarter", "Quarter"], ["year", "Year"]].map(([b, l]) => <Link key={b} href={link(range, b)} className={pill(by === b)}>{l}</Link>)}
      </div>
      <div className="mb-10 grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-4">
        <Stat big label="Received" value={money(total, "USD")} sub={`${rows.length} payments`} />
        <Stat label={`Best ${by}`} value={money(best.value, "USD", { compact: true })} sub={by === "month" && best.key !== "-" ? monthLabel(best.key) : best.key} />
        <Stat label={`Average per ${by}`} value={money(data.length ? total / data.length : 0, "USD", { compact: true })} />
        <Stat label="Payers" value={String(payers.size)} />
      </div>
      <Section title={`Income per ${by}`}><Columns data={data} label={(k) => (by === "month" ? monthLabel(k).replace(" 20", " ’") : k)} height={170} /></Section>
      <Section title="Total so far"><Line data={cum} height={150} /></Section>
      <Section title="Who paid you most"><BarList rows={top} /></Section>
      {other.length > 0 && <p className="mt-4 text-[12px] text-faint">Not included above: {other.length} payment{other.length > 1 ? "s" : ""} in other currencies ({[...new Set(other.map((p) => p.currency))].join(", ")}).</p>}
    </div>
  );
}
