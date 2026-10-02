import Link from "next/link";
import { loadDeals, bestValue } from "@/lib/queries";
import { STAGES, OPEN_STAGES, CATEGORIES } from "@/lib/constants";
import { DealTable } from "@/components/DealTable";
import { Empty, PageHeader } from "@/components/ui";
import { moneyMap } from "@/lib/format";
import { addMoney } from "@/lib/calc";

export const metadata = { title: "Deals" };
type SP = { q?: string; stage?: string; year?: string; category?: string; pay?: string; tag?: string; sort?: string; dir?: string; agency?: string };

export default async function Deals({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const all = loadDeals();
  let deals = all;
  const q = sp.q?.toLowerCase().trim();
  if (q) deals = deals.filter((d) => [d.name, d.company_name, d.agency_name, d.contact_name, d.category, d.source_notes, d.tags.join(" ")].join(" ").toLowerCase().includes(q));
  if (sp.stage === "open") deals = deals.filter((d) => OPEN_STAGES.includes(d.stage as any));
  else if (sp.stage) deals = deals.filter((d) => d.stage === sp.stage);
  if (sp.year) deals = deals.filter((d) => d.year === sp.year);
  if (sp.category) deals = deals.filter((d) => d.category === sp.category);
  if (sp.tag) deals = deals.filter((d) => d.tags.includes(sp.tag!));
  if (sp.agency) deals = deals.filter((d) => (sp.agency === "direct" ? !d.agency_id : d.agency_id === sp.agency));
  if (sp.pay === "unpaid") deals = deals.filter((d) => d.fin.outstanding);
  if (sp.pay === "unconfirmed") deals = deals.filter((d) => d.payment_state === "presumed_paid" || d.payment_verification === "receipt-inferred");
  if (sp.pay === "noamount") deals = deals.filter((d) => d.fin.gross === null && !["Lead", "Negotiating", "Lost"].includes(d.stage));
  const dir = sp.dir === "asc" ? 1 : -1;
  const sorters: Record<string, (a: any, b: any) => number> = {
    date: (a, b) => (a.deal_date ?? "").localeCompare(b.deal_date ?? ""), amount: (a, b) => (a.fin.gross ?? bestValue(a) ?? -1) - (b.fin.gross ?? bestValue(b) ?? -1), name: (a, b) => a.name.localeCompare(b.name), stage: (a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage),
  };
  deals = [...deals].sort((a, b) => (sorters[sp.sort ?? "date"] ?? sorters.date)(a, b) * dir);
  const years = [...new Set(all.map((d) => d.year))].sort((a, b) => (a === "Undated" ? 1 : b === "Undated" ? -1 : b.localeCompare(a)));
  const href = (patch: Partial<SP>) => { const n = { ...sp, ...patch } as Record<string, string | undefined>; const u = new URLSearchParams(); for (const [k, v] of Object.entries(n)) if (v) u.set(k, v); const s = u.toString(); return `/deals${s ? "?" + s : ""}`; };
  const chip = (on: boolean) => `chip ${on ? "chip-on" : ""}`;
  const total: Record<string, number> = {};
  for (const d of deals) if (d.fin.gross !== null) addMoney(total, d.currency, d.fin.gross);
  const exportHref = `/api/export/deals?${new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString()}`;
  return (
    <div>
      <PageHeader title="Deals" kicker={`${all.length} on record`} sub="Every historical deal, including the ones with missing amounts or dates. Nothing was dropped during import.">
        <a href={exportHref} className="btn btn-sm">Export CSV</a>
      </PageHeader>
      <form className="mb-4 flex gap-2" action="/deals">
        <input name="q" defaultValue={sp.q} placeholder="Filter by company, agency, contact, note…" className="input max-w-md" />
        {Object.entries(sp).filter(([k, v]) => k !== "q" && v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <button className="btn">Filter</button>
        {(sp.q || sp.stage || sp.year || sp.pay || sp.category || sp.tag || sp.agency) && <Link href="/deals" className="btn btn-ghost">Clear</Link>}
      </form>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Link href={href({ stage: undefined })} className={chip(!sp.stage)}>All stages</Link>
        <Link href={href({ stage: "open" })} className={chip(sp.stage === "open")}>Open</Link>
        {STAGES.map((s) => { const n = all.filter((d) => d.stage === s).length; return n ? <Link key={s} href={href({ stage: s })} className={chip(sp.stage === s)}>{s} <span className="opacity-60">{n}</span></Link> : null; })}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="caps self-center pr-1">Year</span>
        <Link href={href({ year: undefined })} className={chip(!sp.year)}>Any</Link>
        {years.map((y) => <Link key={y} href={href({ year: y })} className={chip(sp.year === y)}>{y}</Link>)}
        <span className="caps self-center pl-3 pr-1">Payment</span>
        {[["unpaid", "Unpaid"], ["unconfirmed", "Needs confirmation"], ["noamount", "No amount"]].map(([k, l]) => <Link key={k} href={href({ pay: sp.pay === k ? undefined : k })} className={chip(sp.pay === k)}>{l}</Link>)}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="caps self-center pr-1">Category</span>
        {CATEGORIES.map((c) => all.some((d) => d.category === c) ? <Link key={c} href={href({ category: sp.category === c ? undefined : c })} className={chip(sp.category === c)}>{c}</Link> : null)}
      </div>
      <div className="mb-4 mt-5 flex flex-wrap items-baseline justify-between gap-3 border-t border-line/10 pt-4 text-[12.5px] text-mute">
        <span>{deals.length} deals{Object.keys(total).length ? ` · ${moneyMap(total)} recorded value` : ""}</span>
        <span className="flex gap-3">{[["date", "Date"], ["amount", "Value"], ["stage", "Stage"], ["name", "Name"]].map(([k, l]) => <Link key={k} href={href({ sort: k, dir: (sp.sort ?? "date") === k && sp.dir !== "asc" ? "asc" : "desc" })} className={`hover:text-ink ${(sp.sort ?? "date") === k ? "text-ink" : ""}`}>{l}{(sp.sort ?? "date") === k ? (sp.dir === "asc" ? " ↑" : " ↓") : ""}</Link>)}</span>
      </div>
      {deals.length ? <DealTable deals={deals} /> : <Empty title="No deals match" action={<Link href="/deals" className="btn">Clear filters</Link>}>Try removing a filter.</Empty>}
    </div>
  );
}
