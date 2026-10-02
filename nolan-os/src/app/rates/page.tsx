import { all } from "@/lib/db";
import { loadDeals } from "@/lib/queries";
import { PageHeader, Section, Badge, Empty } from "@/components/ui";
import { addRateCard, addRateItem, confirmRateCard, deleteRateItem } from "@/lib/actions";
import { ConfirmForm } from "@/components/Forms";
import { money } from "@/lib/format";
import { CURRENCIES } from "@/lib/constants";

export const metadata = { title: "Rate cards" };
export default function Rates() {
  const cards = all<any>("SELECT * FROM rate_cards ORDER BY year DESC");
  const items = all<any>("SELECT * FROM rate_card_items ORDER BY base_rate DESC");
  const dels = all<{ deal_id: string; platform: string | null; content_type: string | null; quantity: number | null }>("SELECT deal_id, platform, content_type, quantity FROM deliverables");
  const deals = loadDeals().filter((d) => d.final_amount && d.stage !== "Lost");
  // Observed per-unit fees: only single-line deals, so the fee is not split across unknown content.
  const byDeal = new Map<string, typeof dels>(); for (const x of dels) (byDeal.get(x.deal_id) ?? byDeal.set(x.deal_id, []).get(x.deal_id)!).push(x);
  const obs = new Map<string, { n: number; sum: number; min: number; max: number; years: Map<string, number[]> }>();
  for (const d of deals) { const l = byDeal.get(d.id) ?? []; if (l.length !== 1 || !l[0].platform || !l[0].content_type || !l[0].quantity) continue; const key = `${l[0].platform} · ${l[0].content_type} · ${d.currency}`; const unit = d.final_amount! / l[0].quantity; const o = obs.get(key) ?? { n: 0, sum: 0, min: Infinity, max: 0, years: new Map() }; o.n++; o.sum += unit; o.min = Math.min(o.min, unit); o.max = Math.max(o.max, unit); const ys = o.years.get(d.year) ?? []; ys.push(unit); o.years.set(d.year, ys); obs.set(key, o); }
  const rows = [...obs.entries()].sort((a, b) => b[1].n - a[1].n);
  return (
    <div>
      <PageHeader title="Rate cards" kicker="How your pricing evolved" sub="One card per year. Nothing here is assumed: the spreadsheet's card is kept but flagged as unconfirmed starting points, and no 2024 or 2025 rate cards existed in your sources." />
      {cards.length ? cards.map((c) => (
        <Section key={c.id} title={`${c.year} · ${c.label}`} aside={c.confirmed ? <Badge tone="good">Confirmed by you</Badge> : <Badge tone="warn">Unconfirmed</Badge>}>
          {c.source_notes && <p className="mb-3 text-[12.5px] text-mute">{c.source_notes}</p>}
          <table className="tbl"><thead><tr><th>Platform</th><th>Content</th><th className="text-right">Base rate</th><th>Usage</th><th>Exclusivity</th><th>Whitelisting</th><th>Production</th><th>Travel</th><th>Rush</th><th /></tr></thead><tbody>
            {items.filter((i) => i.rate_card_id === c.id).map((i) => <tr key={i.id}><td>{i.platform}</td><td>{i.content_type}{i.note && <div className="text-[11.5px] text-faint">{i.note}</div>}</td><td className="num">{money(i.base_rate, i.currency)}</td><td className="text-mute">{i.usage_rate ?? "—"}</td><td className="text-mute">{i.exclusivity_rate ?? "—"}</td><td className="text-mute">{i.whitelisting_rate ?? "—"}</td><td className="text-mute">{i.production_rate ?? "—"}</td><td className="text-mute">{i.travel_rate ?? "—"}</td><td className="text-mute">{i.rush_fee ?? "—"}</td><td><ConfirmForm action={deleteRateItem} message="Remove this rate?"><input type="hidden" name="id" value={i.id} /><button className="btn btn-ghost btn-sm text-mute">Remove</button></ConfirmForm></td></tr>)}
          </tbody></table>
          <div className="mt-3 flex flex-wrap items-start gap-3 no-print">
            {!c.confirmed && <form action={confirmRateCard}><input type="hidden" name="id" value={c.id} /><button className="btn btn-sm">These are my real rates</button></form>}
            <details><summary className="btn btn-sm cursor-pointer list-none">Add rate</summary><form action={addRateItem} className="mt-3 grid min-w-[300px] gap-2 sm:grid-cols-3"><input type="hidden" name="rate_card_id" value={c.id} /><input name="platform" placeholder="Platform" className="input" /><input name="content_type" placeholder="Content type" className="input" /><input name="base_rate" placeholder="Base rate" inputMode="decimal" className="input" /><select name="currency" className="input">{CURRENCIES.map((x) => <option key={x}>{x}</option>)}</select><input name="usage_rate" placeholder="Usage (e.g. +30%/mo)" className="input" /><input name="exclusivity_rate" placeholder="Exclusivity" className="input" /><input name="whitelisting_rate" placeholder="Whitelisting" className="input" /><input name="production_rate" placeholder="Production" className="input" /><input name="travel_rate" placeholder="Travel" className="input" /><input name="rush_fee" placeholder="Rush fee" className="input" /><input name="note" placeholder="Notes" className="input sm:col-span-2" /><button className="btn btn-primary">Add</button></form></details>
          </div>
        </Section>
      )) : <Empty title="No rate cards yet" />}
      <details className="mb-10 no-print"><summary className="btn btn-sm cursor-pointer list-none">New year's rate card</summary><form action={addRateCard} className="mt-3 flex max-w-md gap-2"><input name="year" type="number" placeholder="2027" required className="input" /><input name="label" placeholder="Label (optional)" className="input" /><button className="btn btn-primary">Create</button></form></details>
      <Section title="What you actually charged" aside="agreed fee per unit, single-deliverable deals only">
        {rows.length ? <table className="tbl"><thead><tr><th>Deliverable</th><th className="text-right">Deals</th><th className="text-right">Lowest</th><th className="text-right">Average</th><th className="text-right">Highest</th><th>By year (average)</th></tr></thead><tbody>
          {rows.map(([k, o]) => { const cur = k.split(" · ")[2]; return <tr key={k}><td>{k.split(" · ").slice(0, 2).join(" · ")} <span className="text-faint">{cur}</span></td><td className="num">{o.n}</td><td className="num">{money(Math.round(o.min), cur)}</td><td className="num">{money(Math.round(o.sum / o.n), cur)}</td><td className="num">{money(Math.round(o.max), cur)}</td><td className="text-[12.5px] text-mute">{[...o.years.entries()].sort().map(([y, a]) => `${y}: ${money(Math.round(a.reduce((s, v) => s + v, 0) / a.length), cur)}`).join(" · ")}</td></tr>; })}
        </tbody></table> : <p className="text-[13px] text-mute">Not enough structured deals yet. This fills in as deals get a platform, content type, quantity and agreed fee.</p>}
      </Section>
    </div>
  );
}
