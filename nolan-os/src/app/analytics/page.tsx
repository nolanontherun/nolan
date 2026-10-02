import Link from "next/link";
import { analytics, loadDeals } from "@/lib/queries";
import { PageHeader, Section, Stat } from "@/components/ui";
import { BarList, Columns } from "@/components/Charts";
import { money, moneyMap, monthLabel } from "@/lib/format";
import { CATEGORIES } from "@/lib/constants";

export const metadata = { title: "Analytics" };
type SP = { year?: string; category?: string; platform?: string; stage?: string; currency?: string; dealType?: string; company?: string };

export default async function Analytics({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const a = analytics(sp);
  const all = loadDeals();
  const years = [...new Set(all.map((d) => d.year))].sort().reverse();
  const href = (patch: Partial<SP>) => { const n = { ...sp, ...patch } as Record<string, string | undefined>; const u = new URLSearchParams(); for (const [k, v] of Object.entries(n)) if (v) u.set(k, v); return `/analytics${u.toString() ? "?" + u : ""}`; };
  const chip = (on: boolean) => `chip ${on ? "chip-on" : ""}`;
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="mb-2 flex flex-wrap items-center gap-1.5"><span className="caps w-20 shrink-0">{label}</span>{children}</div>;
  const rows = (x: { key: string; value: number; deals: number }[], n = 12) => x.slice(0, n).map((r) => ({ key: `${r.key}${r.deals ? ` (${Math.round(r.deals * 10) / 10})` : ""}`, value: r.value }));
  const empty = a.recognizedDeals === 0;
  return (
    <div>
      <PageHeader title="Analytics" kicker="Everything derived from stored data" sub="Revenue is money received (or counted as received without proof, which is flagged). Only USD is charted unless you set exchange rates in Settings. Charts start at zero." />
      <div className="mb-8 space-y-1">
        <Row label="Year"><Link href={href({ year: undefined })} className={chip(!sp.year)}>All</Link>{years.map((y) => <Link key={y} href={href({ year: y })} className={chip(sp.year === y)}>{y}</Link>)}</Row>
        <Row label="Category"><Link href={href({ category: undefined })} className={chip(!sp.category)}>All</Link>{CATEGORIES.filter((c) => all.some((d) => d.category === c)).map((c) => <Link key={c} href={href({ category: c })} className={chip(sp.category === c)}>{c}</Link>)}</Row>
        <Row label="Platform"><Link href={href({ platform: undefined })} className={chip(!sp.platform)}>All</Link>{["Instagram", "TikTok", "YouTube"].map((c) => <Link key={c} href={href({ platform: c })} className={chip(sp.platform === c)}>{c}</Link>)}</Row>
        <Row label="Status"><Link href={href({ stage: undefined })} className={chip(!sp.stage)}>All</Link>{["Paid", "Content delivered", "Invoice sent", "Production"].map((c) => <Link key={c} href={href({ stage: c })} className={chip(sp.stage === c)}>{c}</Link>)}</Row>
        <Row label="Currency"><Link href={href({ currency: undefined })} className={chip(!sp.currency)}>All</Link>{["USD", "EUR"].map((c) => <Link key={c} href={href({ currency: c })} className={chip(sp.currency === c)}>{c}</Link>)}</Row>
        <Row label="Deal type"><Link href={href({ dealType: undefined })} className={chip(!sp.dealType)}>All</Link>{["Brand deal", "Music promo"].map((c) => <Link key={c} href={href({ dealType: c })} className={chip(sp.dealType === c)}>{c}</Link>)}</Row>
      </div>
      <div className="mb-10 grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-4">
        <Stat big label="Revenue in view" value={money(a.total, "USD", { compact: true })} sub={`${a.recognizedDeals} paid deals of ${a.n}`} />
        <Stat label="Average deal size" value={moneyMap(a.avgDealSize)} sub="booked deals with a known amount" />
        <Stat label="Average time to payment" value={a.avgPay === null ? "Not enough dates" : `${a.avgPay} days`} sub={a.avgPay === null ? undefined : `from ${a.paySamples} deals with invoice or posting date and payment date`} />
        <Stat label="Outstanding" value={moneyMap(a.outstanding)} />
      </div>
      {(Object.keys(a.excluded).length > 0 || a.unverified > 0) && <p className="mb-8 rounded-[5px] border border-line/15 bg-surface px-4 py-3 text-[12.5px] text-mute">{Object.keys(a.excluded).length > 0 && <>Not charted because no exchange rate is set: <b className="text-ink">{moneyMap(a.excluded)}</b>. <Link href="/settings#fx" className="link">Set a rate</Link> to include it (the original amounts stay unchanged). </>}{a.unverified > 0 && <>{money(a.unverified)} in the totals is counted as paid without proof.</>}</p>}
      {empty ? <p className="text-[13.5px] text-mute">No received revenue matches these filters.</p> : (
        <div className="grid gap-x-14 gap-y-2 lg:grid-cols-2">
          <Section title="Revenue by year"><BarList rows={a.byYear} /></Section>
          <Section title="Revenue by month" aside="payments with a date"><Columns data={a.byMonth} label={(k) => monthLabel(k).replace(" 20", " ’")} height={130} /></Section>
          <Section title="By category"><BarList rows={rows(a.byCategory)} /></Section>
          <Section title="By platform" aside="split evenly across a deal's deliverables"><BarList rows={rows(a.byPlatform)} /></Section>
          <Section title="By content type" aside="split evenly"><BarList rows={rows(a.byContentType)} /></Section>
          <Section title="By deal type"><BarList rows={rows(a.byDealType)} /></Section>
          <Section title="By company" aside="top 15"><BarList rows={rows(a.byCompany)} /></Section>
          <Section title="By agency" aside="top 15"><BarList rows={rows(a.byAgency)} /></Section>
          <Section title="By deal source"><BarList rows={rows(a.bySource)} /></Section>
          <Section title="Dedicated vs cross-platform"><BarList rows={rows(a.cross)} /></Section>
          <Section title="Usage and exclusivity fees"><dl className="text-[13.5px]"><div className="flex justify-between border-b border-line/[0.07] py-2"><dt className="text-mute">Usage fees recorded</dt><dd className="tabular-nums">{a.usageRev ? money(a.usageRev) : "None recorded"}</dd></div><div className="flex justify-between py-2"><dt className="text-mute">Exclusivity fees recorded</dt><dd className="tabular-nums">{a.exclRev ? money(a.exclRev) : "None recorded"}</dd></div></dl><p className="mt-2 text-[12px] text-faint">Historical deals mostly lack a usage or exclusivity breakdown, so these are floors, not totals.</p></Section>
        </div>
      )}
    </div>
  );
}
